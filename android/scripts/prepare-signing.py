#!/usr/bin/env python3
"""Create a stable, private signing identity once; never print its passwords."""
import os
import pathlib
import secrets
import shutil
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
private = pathlib.Path.home() / '.local/share/momentum/android-signing'
private.mkdir(parents=True, exist_ok=True, mode=0o700)
private.chmod(0o700)
config = private / 'signing.properties'
keystore = private / 'momentum-release.jks'
if not config.exists():
    if keystore.exists():
        raise SystemExit('A signing key already exists without its configuration. Recover the configuration instead of replacing the key.')
    password = secrets.token_urlsafe(36)
    env = dict(os.environ, MOMENTUM_KEY_PASSWORD=password)
    keytool = str(pathlib.Path(os.environ['JAVA_HOME']) / 'bin/keytool') if os.environ.get('JAVA_HOME') else shutil.which('keytool')
    if not keytool:
        raise SystemExit('Java keytool not found. Configure JAVA_HOME or add Java to PATH.')
    subprocess.run([
        keytool, '-genkeypair', '-keystore', str(keystore),
        '-storetype', 'JKS', '-alias', 'momentum', '-keyalg', 'RSA', '-keysize', '3072',
        '-validity', '10000', '-dname', 'CN=Momentum Personal App',
        '-storepass:env', 'MOMENTUM_KEY_PASSWORD', '-keypass:env', 'MOMENTUM_KEY_PASSWORD',
        '-noprompt',
    ], env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    keystore.chmod(0o600)
    config.write_text(f'storeFile={keystore}\nstorePassword={password}\nkeyAlias=momentum\nkeyPassword={password}\n')
    config.chmod(0o600)
local = root / 'signing.properties'
if local.is_symlink():
    if local.resolve() != config.resolve():
        raise SystemExit('Existing signing.properties points to a different key. Review it before building.')
elif local.exists():
    raise SystemExit('Existing signing.properties preserved. Review it before building.')
else:
    local.symlink_to(config)
print('Private release signing identity ready. Keep the private signing directory for future app updates.')
