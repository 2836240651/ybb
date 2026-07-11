from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php"
)
t = p.read_text(encoding="utf-8")
t = re.sub(
    r"\$row\['actor'\] \?\? '[^']*\);",
    "$row['actor'] ?? '—');",
    t,
)
p.write_text(t, encoding="utf-8")
print("ok")
