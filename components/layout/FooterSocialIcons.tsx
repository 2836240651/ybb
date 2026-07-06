import navigation from "@/lib/data/navigation.json";
import { FacebookIcon, SOCIAL_ICONS } from "@/components/layout/SocialIcons";

export function FooterSocialIcons() {
  return (
    <ul className="footer-social-list" role="list">
      {navigation.footer.social.map((item) => {
        const Icon = SOCIAL_ICONS[item.label] ?? FacebookIcon;
        return (
          <li key={item.href}>
            <a
              href={item.href}
              className="footer-social-link"
              aria-label={item.label}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon className="h-6 w-6" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
