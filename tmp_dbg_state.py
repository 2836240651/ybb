from playwright.sync_api import sync_playwright
from pathlib import Path
state = Path(r'D:\dev\∂¿¡¢’æ…œº‹\wordpress\wp-auth.json')
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    c = b.new_context(storage_state=str(state) if state.exists() else None)
    pg = c.new_page()
    pg.goto('https://carp-ybb.com/wp-admin/media-new.php', wait_until='domcontentloaded')
    print('url', pg.url)
    print('file_inputs', pg.locator("input[type=file]").count())
    print('dropzone', pg.locator('.upload-ui').count())
    c.close(); b.close()
