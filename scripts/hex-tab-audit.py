from pathlib import Path
p = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php"
)
lines = p.read_text(encoding="utf-8").splitlines()
for i in range(94, 97):
    print(i + 1, lines[i].encode("utf-8").hex())
    print(lines[i])
