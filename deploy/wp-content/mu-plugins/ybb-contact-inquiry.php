<?php
/**
 * Plugin Name: YBB Contact Inquiry
 * Description: REST endpoint for static-site contact form ??wp_mail (Site Mailer).
 * Version: 1.2.3
 */

if (!defined('ABSPATH')) {
    exit;
}

const YBB_CONTACT_OPTION = 'ybb_contact_settings';
const YBB_CONTACT_RATE_PREFIX = 'ybb_contact_rate_';
const YBB_CONTACT_MAIL_LOG_OPTION = 'ybb_contact_mail_log';
const YBB_CONTACT_MAIL_LOG_MAX = 30;
const YBB_CONTACT_INQUIRIES_OPTION = 'ybb_contact_inquiries';
const YBB_CONTACT_INQUIRIES_MAX = 200;
/** All contact inquiries deliver to this inbox (company sales). */
const YBB_CONTACT_RECIPIENT = 'carpybb@gmail.com';

function ybb_contact_defaults(): array
{
    return [
        'recipientEmail' => YBB_CONTACT_RECIPIENT,
        'rateLimitPerHour' => 10,
    ];
}

function ybb_contact_get_settings(): array
{
    $defaults = ybb_contact_defaults();
    $stored = get_option(YBB_CONTACT_OPTION, []);
    if (!is_array($stored)) {
        $stored = [];
    }

    $email = sanitize_email((string) ($stored['recipientEmail'] ?? ''));
    if ($email === '' && function_exists('ybb_sm_contact_get_raw')) {
        $contact = ybb_sm_contact_get_raw();
        $smEmail = sanitize_email((string) ($contact['salesEmail'] ?? ''));
        if ($smEmail !== '') {
            $email = $smEmail;
        }
    }
    if ($email === '') {
        $email = sanitize_email((string) $defaults['recipientEmail']);
    }

    return [
        'recipientEmail' => $email,
        'rateLimitPerHour' => max(1, (int) ($stored['rateLimitPerHour'] ?? $defaults['rateLimitPerHour'])),
        'smtp' => is_array($stored['smtp'] ?? null) ? $stored['smtp'] : [],
    ];
}

function ybb_contact_smtp_settings(): ?array
{
    $settings = ybb_contact_get_settings();
    $smtp = $settings['smtp'] ?? [];
    if (!is_array($smtp)) {
        return null;
    }

    $user = sanitize_email((string) ($smtp['user'] ?? ''));
    $pass = (string) ($smtp['pass'] ?? '');
    if ($user === '' || $pass === '') {
        return null;
    }

    $encryption = (string) ($smtp['encryption'] ?? 'tls');
    if (!in_array($encryption, ['tls', 'ssl'], true)) {
        $encryption = 'tls';
    }

    return [
        'host' => (string) ($smtp['host'] ?? 'smtp.gmail.com'),
        'port' => max(1, (int) ($smtp['port'] ?? 587)),
        'encryption' => $encryption,
        'user' => $user,
        'pass' => $pass,
    ];
}

function ybb_contact_subject_labels(): array
{
    return [
        'wholesale' => 'Wholesale RFQ',
        'oem' => 'OEM / ODM inquiry',
        'samples' => 'Sample request',
        'other' => 'Other',
    ];
}

function ybb_contact_client_ip(): string
{
    $candidates = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
    foreach ($candidates as $key) {
        if (empty($_SERVER[$key])) {
            continue;
        }
        $raw = (string) $_SERVER[$key];
        if ($key === 'HTTP_X_FORWARDED_FOR') {
            $raw = trim(explode(',', $raw)[0]);
        }
        if (filter_var($raw, FILTER_VALIDATE_IP)) {
            return $raw;
        }
    }
    return '0.0.0.0';
}

function ybb_contact_rate_limited(string $ip, int $limit): bool
{
    $key = YBB_CONTACT_RATE_PREFIX . md5($ip);
    $count = (int) get_transient($key);
    if ($count >= $limit) {
        return true;
    }
    set_transient($key, $count + 1, HOUR_IN_SECONDS);
    return false;
}

function ybb_contact_sanitize_payload($request): array|WP_Error
{
    $body = $request->get_json_params();
    if (!is_array($body)) {
        return new WP_Error('ybb_contact_invalid', 'Invalid JSON body.', ['status' => 400]);
    }

    // Honeypot ??bots fill hidden "website" field.
    if (!empty($body['website'])) {
        return new WP_Error('ybb_contact_spam', 'Submission rejected.', ['status' => 400]);
    }

    $name = sanitize_text_field((string) ($body['name'] ?? ''));
    $email = sanitize_email((string) ($body['email'] ?? ''));
    $company = sanitize_text_field((string) ($body['company'] ?? ''));
    $subject = sanitize_key((string) ($body['subject'] ?? ''));
    $message = sanitize_textarea_field((string) ($body['message'] ?? ''));
    $locale = sanitize_key((string) ($body['locale'] ?? 'en'));

    if ($name === '' || strlen($name) > 120) {
        return new WP_Error('ybb_contact_name', 'Name is required.', ['status' => 400]);
    }
    if ($email === '' || !is_email($email)) {
        return new WP_Error('ybb_contact_email', 'Valid email is required.', ['status' => 400]);
    }
    if ($company === '' || strlen($company) > 160) {
        return new WP_Error('ybb_contact_company', 'Company is required.', ['status' => 400]);
    }
    if (!array_key_exists($subject, ybb_contact_subject_labels())) {
        return new WP_Error('ybb_contact_subject', 'Invalid subject.', ['status' => 400]);
    }
    if ($message === '' || strlen($message) < 10 || strlen($message) > 5000) {
        return new WP_Error('ybb_contact_message', 'Message must be 10??000 characters.', ['status' => 400]);
    }
    if (!in_array($locale, ['en', 'zh', 'ja'], true)) {
        $locale = 'en';
    }

    return compact('name', 'email', 'company', 'subject', 'message', 'locale');
}

function ybb_contact_store_inquiry(array $data): string
{
    $id = wp_generate_uuid4();
    $entry = [
        'id' => $id,
        'at' => gmdate('c'),
        'ip' => ybb_contact_client_ip(),
        'name' => $data['name'],
        'email' => $data['email'],
        'company' => $data['company'],
        'subject' => $data['subject'],
        'subjectLabel' => ybb_contact_subject_labels()[$data['subject']] ?? $data['subject'],
        'message' => $data['message'],
        'locale' => $data['locale'],
        'mailSent' => false,
    ];

    $inquiries = get_option(YBB_CONTACT_INQUIRIES_OPTION, []);
    if (!is_array($inquiries)) {
        $inquiries = [];
    }
    array_unshift($inquiries, $entry);
    $inquiries = array_slice($inquiries, 0, YBB_CONTACT_INQUIRIES_MAX);
    update_option(YBB_CONTACT_INQUIRIES_OPTION, $inquiries, false);

    return $id;
}

function ybb_contact_mark_inquiry_mail_sent(string $id, bool $sent): void
{
    $inquiries = get_option(YBB_CONTACT_INQUIRIES_OPTION, []);
    if (!is_array($inquiries)) {
        return;
    }
    foreach ($inquiries as &$row) {
        if (($row['id'] ?? '') === $id) {
            $row['mailSent'] = $sent;
            break;
        }
    }
    unset($row);
    update_option(YBB_CONTACT_INQUIRIES_OPTION, $inquiries, false);
}

function ybb_contact_backup_emails(): array
{
    $emails = [];
    $admin = sanitize_email((string) get_option('admin_email', ''));
    if ($admin !== '' && is_email($admin)) {
        $emails[] = $admin;
    }
    return array_values(array_unique($emails));
}

function ybb_contact_mail_log_append(array $entry): void
{
    $log = get_option(YBB_CONTACT_MAIL_LOG_OPTION, []);
    if (!is_array($log)) {
        $log = [];
    }
    array_unshift($log, $entry);
    $log = array_slice($log, 0, YBB_CONTACT_MAIL_LOG_MAX);
    update_option(YBB_CONTACT_MAIL_LOG_OPTION, $log, false);
}

function ybb_contact_mail_from_address(): string
{
    $from = (string) apply_filters('wp_mail_from', get_option('admin_email') ?: '');
    return sanitize_email($from) ?: 'unknown';
}

function ybb_contact_mail_from_name(): string
{
    return (string) apply_filters('wp_mail_from_name', get_bloginfo('name') ?: 'WordPress');
}

function ybb_contact_mail_transport(): array
{
    $active = static function (string $slug): bool {
        if (!function_exists('is_plugin_active')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        return is_plugin_active($slug);
    };

    return [
        'siteMailer' => $active('site-mailer/site-mailer.php'),
        'wpMailSmtp' => $active('wp-mail-smtp/wp_mail_smtp.php'),
        'postSmtp' => $active('post-smtp/postman-smtp.php'),
    ];
}

function ybb_contact_mail_status(): array
{
    $settings = ybb_contact_get_settings();
    $log = get_option(YBB_CONTACT_MAIL_LOG_OPTION, []);
    if (!is_array($log)) {
        $log = [];
    }

    $wcFrom = '';
    if (function_exists('get_option')) {
        $wcFrom = sanitize_email((string) get_option('woocommerce_email_from_address', ''));
    }

    $smtp = ybb_contact_smtp_settings();

    return [
        'recipientEmail' => $settings['recipientEmail'],
        'legacyOptionEmail' => sanitize_email((string) (get_option(YBB_CONTACT_OPTION, [])['recipientEmail'] ?? '')),
        'siteManagerSalesEmail' => function_exists('ybb_sm_contact_public')
            ? sanitize_email((string) (ybb_sm_contact_public()['salesEmail'] ?? ''))
            : (function_exists('ybb_sm_contact_get_raw')
                ? sanitize_email((string) (ybb_sm_contact_get_raw()['salesEmail'] ?? ''))
                : ''),
        'mailFrom' => ybb_contact_mail_from_address(),
        'mailFromName' => ybb_contact_mail_from_name(),
        'adminEmail' => sanitize_email((string) get_option('admin_email', '')),
        'woocommerceFrom' => $wcFrom,
        'contactFrom' => ybb_contact_outbound_from(),
        'smtpConfigured' => $smtp !== null,
        'smtpUser' => $smtp['user'] ?? '',
        'transport' => ybb_contact_mail_transport(),
        'backupEmails' => ybb_contact_backup_emails(),
        'storedInquiryCount' => count(is_array(get_option(YBB_CONTACT_INQUIRIES_OPTION, [])) ? get_option(YBB_CONTACT_INQUIRIES_OPTION, []) : []),
        'lastAttempts' => array_slice($log, 0, 10),
    ];
}

function ybb_contact_outbound_from(): string
{
    $smtp = ybb_contact_smtp_settings();
    if ($smtp !== null) {
        return $smtp['user'];
    }

    $woo = sanitize_email((string) get_option('woocommerce_email_from_address', ''));
    if ($woo !== '' && str_ends_with(strtolower($woo), '@carp-ybb.com')) {
        return $woo;
    }
    return 'noreply@carp-ybb.com';
}

function ybb_contact_phpmailer_smtp($phpmailer): void
{
    global $ybb_contact_mail_inflight;
    if (empty($ybb_contact_mail_inflight)) {
        return;
    }

    $smtp = ybb_contact_smtp_settings();
    if ($smtp === null) {
        return;
    }

    $phpmailer->isSMTP();
    $phpmailer->Host = $smtp['host'];
    $phpmailer->Port = $smtp['port'];
    $phpmailer->SMTPSecure = $smtp['encryption'];
    $phpmailer->SMTPAuth = true;
    $phpmailer->Username = $smtp['user'];
    $phpmailer->Password = $smtp['pass'];
    $phpmailer->Sender = $smtp['user'];
}

function ybb_contact_send_mail(array $data, ?string $inquiryId = null): bool
{
    global $ybb_contact_mail_inflight;
    $settings = ybb_contact_get_settings();
    $subjectLabel = ybb_contact_subject_labels()[$data['subject']] ?? $data['subject'];
    $siteName = get_bloginfo('name') ?: 'YBB';
    $mailSubject = sprintf(
        '[%s] %s ??%s',
        $siteName,
        $subjectLabel,
        $data['company']
    );

    $lines = [
        'New contact inquiry from carp-ybb.com',
        '',
        'Name: ' . $data['name'],
        'Email: ' . $data['email'],
        'Company: ' . $data['company'],
        'Subject: ' . $subjectLabel,
        'Locale: ' . strtoupper($data['locale']),
        'IP: ' . ybb_contact_client_ip(),
        '',
        'Message:',
        $data['message'],
    ];
    $body = implode("\n", $lines);

    $to = $settings['recipientEmail'] !== '' ? $settings['recipientEmail'] : YBB_CONTACT_RECIPIENT;
    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        sprintf('Reply-To: %s <%s>', $data['name'], $data['email']),
    ];
    foreach (ybb_contact_backup_emails() as $backupEmail) {
        if (strcasecmp($backupEmail, $to) !== 0) {
            $headers[] = 'Bcc: ' . $backupEmail;
        }
    }

    $from = ybb_contact_outbound_from();
    $fromName = (string) get_option('woocommerce_email_from_name', 'YBB');

    $fromFilter = static fn () => $from;
    $fromNameFilter = static fn () => $fromName;
    add_filter('wp_mail_from', $fromFilter, 100);
    add_filter('wp_mail_from_name', $fromNameFilter, 100);

    $ybb_contact_mail_inflight = true;
    $sent = wp_mail($to, $mailSubject, $body, $headers);
    $ybb_contact_mail_inflight = false;

    remove_filter('wp_mail_from', $fromFilter, 100);
    remove_filter('wp_mail_from_name', $fromNameFilter, 100);

    $error = '';
    global $phpmailer;
    if (isset($phpmailer) && is_object($phpmailer) && !empty($phpmailer->ErrorInfo)) {
        $error = (string) $phpmailer->ErrorInfo;
    }

    ybb_contact_mail_log_append([
        'at' => gmdate('c'),
        'to' => $to,
        'bcc' => implode(', ', array_diff(ybb_contact_backup_emails(), [$to])),
        'subject' => $mailSubject,
        'from' => $from,
        'sent' => (bool) $sent,
        'error' => $error,
        'company' => $data['company'],
        'ip' => ybb_contact_client_ip(),
        'inquiryId' => $inquiryId,
    ]);

    if ($inquiryId !== null && $inquiryId !== '') {
        ybb_contact_mark_inquiry_mail_sent($inquiryId, (bool) $sent);
    }

    return $sent;
}

function ybb_contact_handle_submit(WP_REST_Request $request): WP_REST_Response|WP_Error
{
    $settings = ybb_contact_get_settings();
    $ip = ybb_contact_client_ip();
    if (ybb_contact_rate_limited($ip, $settings['rateLimitPerHour'])) {
        return new WP_Error(
            'ybb_contact_rate_limit',
            'Too many submissions. Please try again later.',
            ['status' => 429]
        );
    }

    $data = ybb_contact_sanitize_payload($request);
    if (is_wp_error($data)) {
        return $data;
    }

    $inquiryId = ybb_contact_store_inquiry($data);
    $sent = ybb_contact_send_mail($data, $inquiryId);

    return rest_ensure_response([
        'ok' => true,
        'message' => $sent
            ? 'Inquiry sent.'
            : 'Inquiry received. Email delivery is delayed ??our team will follow up.',
        'mailSent' => (bool) $sent,
        'inquiryId' => $inquiryId,
    ]);
}

add_action('wp_mail_failed', function ($error) {
    global $ybb_contact_mail_inflight;
    if (empty($ybb_contact_mail_inflight)) {
        return;
    }
    if (!$error instanceof WP_Error) {
        return;
    }
    $log = get_option(YBB_CONTACT_MAIL_LOG_OPTION, []);
    if (!is_array($log) || $log === []) {
        return;
    }
    $log[0]['failedHook'] = $error->get_error_message();
    $data = $error->get_error_data();
    if (is_array($data)) {
        if (!empty($data['to'])) {
            $log[0]['to'] = is_array($data['to']) ? implode(', ', $data['to']) : (string) $data['to'];
        }
        if (!empty($data['subject'])) {
            $log[0]['subject'] = (string) $data['subject'];
        }
    }
    update_option(YBB_CONTACT_MAIL_LOG_OPTION, $log, false);
}, 10, 1);

add_action('phpmailer_init', 'ybb_contact_phpmailer_smtp', 99999);

/** Public contact page reads site-manager/contact; keep salesEmail aligned with inquiry inbox. */
add_filter('rest_post_dispatch', function ($response, $server, $request) {
    if (!is_object($response) || !method_exists($response, 'get_data')) {
        return $response;
    }
    if ($request->get_route() !== '/ybb/v1/site-manager/contact') {
        return $response;
    }
    $data = $response->get_data();
    if (!is_array($data)) {
        return $response;
    }
    $settings = ybb_contact_get_settings();
    $email = sanitize_email((string) ($settings['recipientEmail'] ?? ''));
    if ($email !== '') {
        $data['salesEmail'] = $email;
        $response->set_data($data);
    }
    return $response;
}, 20, 3);

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/contact-inquiry', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_contact_handle_submit',
    ]);

    register_rest_route('ybb/v1', '/contact-mail-status', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => static function () {
            if (!headers_sent()) {
                header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
                header('Pragma: no-cache');
            }
            return rest_ensure_response(ybb_contact_mail_status());
        },
    ]);
});

add_action('admin_init', function () {
    register_setting('ybb_contact_group', YBB_CONTACT_OPTION, [
        'type' => 'array',
        'sanitize_callback' => function ($input) {
            $defaults = ybb_contact_defaults();
            $existing = get_option(YBB_CONTACT_OPTION, []);
            if (!is_array($existing)) {
                $existing = [];
            }
            $input = is_array($input) ? $input : [];
            $email = sanitize_email((string) ($input['recipientEmail'] ?? $defaults['recipientEmail']));

            $smtpIn = is_array($input['smtp'] ?? null) ? $input['smtp'] : [];
            $smtpExisting = is_array($existing['smtp'] ?? null) ? $existing['smtp'] : [];
            $smtpUser = sanitize_email((string) ($smtpIn['user'] ?? $smtpExisting['user'] ?? ''));
            $smtpPass = (string) ($smtpIn['pass'] ?? '');
            if ($smtpPass === '') {
                $smtpPass = (string) ($smtpExisting['pass'] ?? '');
            }
            $smtpHost = sanitize_text_field((string) ($smtpIn['host'] ?? $smtpExisting['host'] ?? 'smtp.gmail.com'));
            $smtpPort = max(1, (int) ($smtpIn['port'] ?? $smtpExisting['port'] ?? 587));
            $smtpEncryption = (string) ($smtpIn['encryption'] ?? $smtpExisting['encryption'] ?? 'tls');
            if (!in_array($smtpEncryption, ['tls', 'ssl'], true)) {
                $smtpEncryption = 'tls';
            }

            return [
                'recipientEmail' => $email !== '' ? $email : $defaults['recipientEmail'],
                'rateLimitPerHour' => max(1, (int) ($input['rateLimitPerHour'] ?? $defaults['rateLimitPerHour'])),
                'smtp' => [
                    'host' => $smtpHost !== '' ? $smtpHost : 'smtp.gmail.com',
                    'port' => $smtpPort,
                    'encryption' => $smtpEncryption,
                    'user' => $smtpUser,
                    'pass' => $smtpPass,
                ],
            ];
        },
        'default' => ybb_contact_defaults(),
    ]);
});

add_action('admin_menu', function () {
    add_options_page(
        'YBB Contact',
        'YBB Contact',
        'manage_options',
        'ybb-contact',
        function () {
            if (!current_user_can('manage_options')) {
                return;
            }
            $settings = ybb_contact_get_settings();
            ?>
            <div class="wrap">
                <h1>YBB Contact</h1>
                <p>??? Contact ???? <code>POST /wp-json/ybb/v1/contact-inquiry</code> ????????Outlook SMTP???? SMTP ?????? Site Mailer??/p>
                <p>????code><?php echo esc_html(rest_url('ybb/v1/contact-mail-status')); ?></code></p>
                <p><strong>????/strong>??<a href="<?php echo esc_url(admin_url('admin.php?page=ybb-site-manager&tab=contact')); ?>">YBB ???? ??????/a> ??????????????????????????/p>
                <p><strong>Backup inbox</strong> BCC to <code><?php echo esc_html(implode(', ', ybb_contact_backup_emails()) ?: '-'); ?></code>. Inquiries are also stored below when mail fails.</p>
                <?php
                $inquiries = get_option(YBB_CONTACT_INQUIRIES_OPTION, []);
                if (!is_array($inquiries)) {
                    $inquiries = [];
                }
                if ($inquiries !== []) :
                    ?>
                    <h2>????????????????/h2>
                    <table class="widefat striped">
                        <thead>
                        <tr>
                            <th>?? (UTC)</th>
                            <th>??</th>
                            <th>??</th>
                            <th>??</th>
                            <th>??</th>
                            <th>??</th>
                            <th>??</th>
                        </tr>
                        </thead>
                        <tbody>
                        <?php foreach (array_slice($inquiries, 0, 30) as $row) : ?>
                            <tr>
                                <td><?php echo esc_html((string) ($row['at'] ?? '')); ?></td>
                                <td><?php echo esc_html((string) ($row['name'] ?? '')); ?></td>
                                <td><a href="mailto:<?php echo esc_attr((string) ($row['email'] ?? '')); ?>"><?php echo esc_html((string) ($row['email'] ?? '')); ?></a></td>
                                <td><?php echo esc_html((string) ($row['company'] ?? '')); ?></td>
                                <td><?php echo esc_html((string) ($row['subjectLabel'] ?? $row['subject'] ?? '')); ?></td>
                                <td><?php echo !empty($row['mailSent']) ? 'sent' : 'stored'; ?></td>
                                <td><?php echo esc_html(wp_trim_words((string) ($row['message'] ?? ''), 18, '...')); ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
                <?php
                $status = ybb_contact_mail_status();
                $attempts = $status['lastAttempts'] ?? [];
                if ($attempts !== []) :
                    ?>
                    <h2>???????/h2>
                    <table class="widefat striped">
                        <thead>
                        <tr>
                            <th>?? (UTC)</th>
                            <th>??</th>
                            <th>??</th>
                            <th>wp_mail</th>
                            <th>??</th>
                        </tr>
                        </thead>
                        <tbody>
                        <?php foreach ($attempts as $row) : ?>
                            <tr>
                                <td><?php echo esc_html((string) ($row['at'] ?? '')); ?></td>
                                <td><?php echo esc_html((string) ($row['to'] ?? '')); ?></td>
                                <td><?php echo esc_html((string) ($row['subject'] ?? '')); ?></td>
                                <td><?php echo !empty($row['sent']) ? 'true' : 'false'; ?></td>
                                <td><?php echo esc_html((string) ($row['error'] ?? $row['failedHook'] ?? '')); ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
                <form method="post" action="options.php">
                    <?php settings_fields('ybb_contact_group'); ?>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><label for="ybb_contact_recipient">????</label></th>
                            <td>
                                <input type="email" class="regular-text" id="ybb_contact_recipient"
                                       name="<?php echo esc_attr(YBB_CONTACT_OPTION); ?>[recipientEmail]"
                                       value="<?php echo esc_attr($settings['recipientEmail']); ?>" />
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><label for="ybb_contact_rate">???? IP ??</label></th>
                            <td>
                                <input type="number" min="1" max="50" id="ybb_contact_rate"
                                       name="<?php echo esc_attr(YBB_CONTACT_OPTION); ?>[rateLimitPerHour]"
                                       value="<?php echo esc_attr((string) $settings['rateLimitPerHour']); ?>" />
                            </td>
                        </tr>
                    </table>
                    <?php submit_button('??'); ?>
                </form>
            </div>
            <?php
        }
    );
});
