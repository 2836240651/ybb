import json
from pathlib import Path
from playwright.sync_api import sync_playwright

s = json.loads(Path('secrets.local.json').read_text(encoding='utf-8'))['wordpress']
admin = s['adminUrl'].rstrip('/')

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    c = b.new_context()
    pg = c.new_page()
    pg.goto(admin + '/upload.php?mode=list', wait_until='domcontentloaded')
    print('u1', pg.url)
    if 'wp-login.php' in pg.url:
        pg.fill('#user_login', s['email'])
        pg.fill('#user_pass', s['password'])
        pg.click('#wp-submit')
        pg.wait_for_load_state('domcontentloaded')
    print('u2', pg.url)
    pg.goto(admin + '/media-new.php', wait_until='domcontentloaded')
    print('u3', pg.url, 'title', pg.title())
    print('file_inputs', pg.locator("input[type='file']").count())
    print('select_files_text', pg.locator("text=Select Files").count())
    print('upload_ui', pg.locator('.upload-ui').count())
    html = pg.content()
    print('has_media_new', 'media-new.php' in html)
    c.close()
    b.close()
