<?php
require __DIR__ . '/wp-load.php';
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') exit('forbidden');
$prefixes = [];
foreach (wc_get_products(['limit'=>-1,'return'=>'objects']) as $p) {
    $sku = $p->get_sku();
    if (preg_match('/^(TZ-[A-Z]+)/', $sku, $m)) {
        $prefixes[$m[1]] = ($prefixes[$m[1]] ?? 0) + 1;
    } else {
        $prefixes['(other)'] = ($prefixes['(other)'] ?? 0) + 1;
    }
}
arsort($prefixes);
foreach ($prefixes as $k=>$v) echo "$k\t$v\n";
