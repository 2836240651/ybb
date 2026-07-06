from pathlib import Path
import re
from scripts.deploy_ftps import load_secrets, with_client, cwd_to

ftp = load_secrets()["ftp"]
root = ftp["remoteRoot"].rstrip("/")
pat = re.compile(
    r"chat|tidio|crisp|tawk|livechat|zendesk|gorgias|intercom|whatsapp|messenger|chatway|chaty|smartsupp|drift|olark|freshchat|hubspot",
    re.I,
)


def list_plugins(client):
    cwd_to(client, root + "/wp-content/plugins")
    items = []
    client.retrlines("NLST", items.append)
    return sorted(items)


plugins = with_client(ftp, list_plugins)
chat = [p for p in plugins if pat.search(p)]
print(f"PLUGIN_DIRS: {len(plugins)}")
print(f"CHAT_DIRS: {chat if chat else '(none)'}")
for p in plugins:
    print(p)
