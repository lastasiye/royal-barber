#!/usr/bin/env python3
"""
Royar Barber Shop — Local Development Server
PHP backend yerine Python ile çalışır.
Kullanım: python server.py
"""

import http.server
import json
import os
import uuid
import secrets
from urllib.parse import urlparse

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')
PW_FILE = os.path.join(BASE_DIR, 'password.json')
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')

sessions = {}  # token -> {authenticated, username, ip, ua, last_activity}
login_attempts = {}  # IP -> [timestamp, ...]
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 900  # 15 Minuten
SESSION_TIMEOUT = 1800  # 30 Minuten

def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

def verify_password(plain, hashed):
    try:
        import bcrypt
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ImportError:
        if plain == 'admin':
            return True
        return False

def hash_password(plain):
    try:
        import bcrypt
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()
    except ImportError:
        return f"$plain${plain}"

def parse_multipart(body, boundary):
    """Parse multipart/form-data without cgi module."""
    boundary = boundary.encode()
    parts = body.split(b'--' + boundary)
    files = {}
    for part in parts:
        if not part or part.strip() == b'' or part.strip() == b'--':
            continue
        if b'\r\n\r\n' not in part:
            continue
        header_data, file_data = part.split(b'\r\n\r\n', 1)
        if file_data.endswith(b'\r\n'):
            file_data = file_data[:-2]
        headers = header_data.decode('utf-8', errors='replace')
        if 'filename="' in headers:
            name_start = headers.index('name="') + 6
            name_end = headers.index('"', name_start)
            field_name = headers[name_start:name_end]
            fn_start = headers.index('filename="') + 10
            fn_end = headers.index('"', fn_start)
            filename = headers[fn_start:fn_end]
            if filename:
                files[field_name] = {'filename': filename, 'data': file_data}
    return files


class RoyarHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Dev server: no caching for anything
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        # Hassas dosyalara erişimi engelle
        blocked = ['password.json', 'config.php', 'rate_limit.json', '.htaccess']
        basename = os.path.basename(path)
        if basename in blocked or basename.endswith('.bak'):
            self.send_error(403, 'Forbidden')
            return
        # .git klasörü engelle
        if '/.git' in path or path.startswith('.git'):
            self.send_error(404, 'Not Found')
            return
        # Directory listing engelle (sadece dosyalara izin ver)
        full_path = os.path.join(BASE_DIR, path.lstrip('/'))
        if os.path.isdir(full_path) and path != '/' and not path.endswith('/index.html'):
            self.send_error(403, 'Forbidden')
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        routes = {
            '/api/login.php': self.handle_login,
            '/api/save-data.php': self.handle_save_data,
            '/api/upload-image.php': self.handle_upload_image,
            '/api/delete-image.php': self.handle_delete_image,
            '/api/change-password.php': self.handle_change_password,
            '/api/logout.php': self.handle_logout,
        }
        handler = routes.get(path)
        if handler:
            try:
                handler()
            except Exception as e:
                print(f"[ERROR] {path}: {e}")
                self.send_json({'success': False, 'error': str(e)}, 500)
        else:
            self.send_error(404)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length)

    def read_json_body(self):
        try:
            return json.loads(self.read_body().decode('utf-8'))
        except Exception:
            return {}

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(body)

    def require_auth(self):
        import time
        token = self.headers.get('X-CSRF-Token', '')
        session = sessions.get(token)
        if not session or not session.get('authenticated'):
            self.send_json({'success': False, 'error': 'Anmeldung erforderlich'}, 401)
            return False
        # Session timeout kontrolü
        if time.time() - session.get('last_activity', 0) > SESSION_TIMEOUT:
            del sessions[token]
            self.send_json({'success': False, 'error': 'Sitzung abgelaufen'}, 401)
            return False
        # IP binding kontrolü
        client_ip = self.client_address[0]
        client_ua = self.headers.get('User-Agent', '')
        if session.get('ip') != client_ip or session.get('ua') != client_ua:
            del sessions[token]
            self.send_json({'success': False, 'error': 'Sitzung ungültig'}, 401)
            return False
        session['last_activity'] = time.time()
        return True

    def check_rate_limit(self):
        ip = self.client_address[0]
        import time
        now = time.time()
        if ip in login_attempts:
            login_attempts[ip] = [t for t in login_attempts[ip] if now - t < RATE_LIMIT_WINDOW]
        else:
            login_attempts[ip] = []
        if len(login_attempts[ip]) >= RATE_LIMIT_MAX:
            remaining = int(RATE_LIMIT_WINDOW - (now - login_attempts[ip][0]))
            self.send_json({'success': False, 'error': f'Zu viele Versuche. Bitte warten Sie {remaining} Sekunden.'}, 429)
            return False
        return True

    def handle_login(self):
        if not self.check_rate_limit():
            return
        body = self.read_json_body()
        username = body.get('username', '')
        password = body.get('password', '')
        if not username or not password:
            self.send_json({'success': False, 'error': 'Felder fehlen'}, 400)
            return
        pw_data = read_json(PW_FILE)
        if username.lower() == pw_data.get('username', '').lower() and verify_password(password, pw_data.get('password_hash', '')):
            import time as _time
            token = secrets.token_hex(32)
            sessions[token] = {
                'authenticated': True,
                'username': username,
                'ip': self.client_address[0],
                'ua': self.headers.get('User-Agent', ''),
                'last_activity': _time.time()
            }
            print(f"[LOGIN] {username} OK")
            self.send_json({'success': True, 'data': {'message': 'OK', 'csrf_token': token}})
        else:
            import time
            ip = self.client_address[0]
            if ip not in login_attempts:
                login_attempts[ip] = []
            login_attempts[ip].append(time.time())
            self.send_json({'success': False, 'error': 'Falscher Login'}, 401)

    def handle_logout(self):
        token = self.headers.get('X-CSRF-Token', '')
        if token in sessions:
            del sessions[token]
            print(f"[LOGOUT] Session destroyed")
        self.send_json({'success': True, 'data': {'message': 'Abgemeldet'}})

    def handle_save_data(self):
        if not self.require_auth():
            return
        body = self.read_json_body()
        if not body:
            self.send_json({'success': False, 'error': 'Leere Daten'}, 400)
            return
        allowed = ['gallery', 'services', 'products', 'hours', 'contact']
        for k in body:
            if k not in allowed:
                self.send_json({'success': False, 'error': f'Feld nicht erlaubt: {k}'}, 400)
                return
        current = read_json(DATA_FILE)

        # Input validation
        for k, v in body.items():
            current[k] = v

        # Services/Products validation
        for key in ['services', 'products']:
            if key in current and isinstance(current[key], list):
                for item in current[key]:
                    if isinstance(item, dict):
                        if 'name' in item and len(str(item['name'])) > 200:
                            self.send_json({'success': False, 'error': f'Name zu lang (max 200 Zeichen)'}, 400)
                            return
                        if 'price' in item:
                            try:
                                price = float(item['price'])
                                if price < 0 or price > 99999:
                                    self.send_json({'success': False, 'error': 'Ungültiger Preis (0-99999)'}, 400)
                                    return
                            except (ValueError, TypeError):
                                self.send_json({'success': False, 'error': 'Preis muss eine Zahl sein'}, 400)
                                return

        # Backup erstellen
        import shutil
        if os.path.exists(DATA_FILE):
            shutil.copy2(DATA_FILE, DATA_FILE + '.bak')

        write_json(DATA_FILE, current)
        print(f"[SAVE] data.json updated: {list(body.keys())}")
        self.send_json({'success': True, 'data': {'message': 'Gespeichert'}})

    def handle_upload_image(self):
        if not self.require_auth():
            return
        content_type = self.headers.get('Content-Type', '')
        if 'boundary=' not in content_type:
            self.send_json({'success': False, 'error': 'Kein multipart'}, 400)
            return
        boundary = content_type.split('boundary=')[1].strip()
        body = self.read_body()
        files = parse_multipart(body, boundary)
        if 'image' not in files:
            self.send_json({'success': False, 'error': 'Keine Datei'}, 400)
            return
        f = files['image']
        if len(f['data']) > 5 * 1024 * 1024:
            self.send_json({'success': False, 'error': 'Max 5MB'}, 400)
            return
        ext = os.path.splitext(f['filename'])[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
            self.send_json({'success': False, 'error': 'Nur JPG/PNG/WebP'}, 400)
            return
        # Gerçek MIME type kontrolü (magic bytes)
        import imghdr
        img_type = imghdr.what(None, h=f['data'][:32])
        allowed_types = {'jpeg', 'png', 'webp'}
        if img_type not in allowed_types:
            self.send_json({'success': False, 'error': f'Ungültiger Bildtyp: {img_type}'}, 400)
            return
        # Path traversal koruması - dosya adında sadece güvenli karakterler
        safe_name = os.path.basename(f['filename'])
        if '..' in safe_name or '/' in safe_name or '\\' in safe_name:
            self.send_json({'success': False, 'error': 'Ungültiger Dateiname'}, 400)
            return
        new_name = f"img_{uuid.uuid4().hex[:8]}{ext}"
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        with open(os.path.join(UPLOADS_DIR, new_name), 'wb') as out:
            out.write(f['data'])
        print(f"[UPLOAD] {new_name}")
        self.send_json({'success': True, 'filename': new_name})

    def handle_delete_image(self):
        if not self.require_auth():
            return
        body = self.read_json_body()
        img_id = str(body.get('id', ''))
        if not img_id:
            self.send_json({'success': False, 'error': 'ID fehlt'}, 400)
            return
        data = read_json(DATA_FILE)
        found = False
        for idx, item in enumerate(data.get('gallery', [])):
            if str(item.get('id', '')) == img_id:
                fp = os.path.join(BASE_DIR, item.get('src', ''))
                if os.path.exists(fp):
                    os.remove(fp)
                data['gallery'].pop(idx)
                found = True
                break
        if not found:
            self.send_json({'success': False, 'error': 'Nicht gefunden'}, 404)
            return
        write_json(DATA_FILE, data)
        print(f"[DELETE] Image {img_id}")
        self.send_json({'success': True})

    def handle_change_password(self):
        if not self.require_auth():
            return
        body = self.read_json_body()
        old_pw = body.get('old_password', '')
        new_pw = body.get('new_password', '')
        if not old_pw or not new_pw:
            self.send_json({'success': False, 'error': 'Felder fehlen'}, 400)
            return
        if len(new_pw) < 6:
            self.send_json({'success': False, 'error': 'Min 6 Zeichen'}, 400)
            return
        pw_data = read_json(PW_FILE)
        if not verify_password(old_pw, pw_data.get('password_hash', '')):
            self.send_json({'success': False, 'error': 'Falsches Passwort'}, 401)
            return
        pw_data['password_hash'] = hash_password(new_pw)
        write_json(PW_FILE, pw_data)

        # Tüm eski session'ları geçersiz kıl
        current_token = self.headers.get('X-CSRF-Token', '')
        tokens_to_remove = [t for t in sessions if t != current_token]
        for t in tokens_to_remove:
            del sessions[t]

        self.send_json({'success': True, 'data': {'message': 'OK'}})

    def log_message(self, fmt, *args):
        msg = args[0] if args else ''
        if '/api/' in msg:
            print(f"[API] {msg}")
        elif '.map' not in msg and 'favicon' not in msg:
            super().log_message(fmt, *args)


if __name__ == '__main__':
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    print(f"""
========================================
  ROYAR BARBER SHOP — Dev Server

  Ana Site:  http://localhost:{PORT}
  Admin:     http://localhost:{PORT}/admin.html
  Login:     admin / admin

  Ctrl+C to stop
========================================
""")
    http.server.HTTPServer(('', PORT), RoyarHandler).serve_forever()
