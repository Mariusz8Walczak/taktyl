#!/bin/sh
# I-005 (TAKTYL-6): tworzy .env z .env.example i wpisuje losowe sekrety lokalne w miejsce CHANGE_ME.
# Nie nadpisuje istniejacego .env. Sekrety nigdy nie trafiaja do repo (.env jest w .gitignore).
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo ".env juz istnieje, nic nie zmieniam."
  exit 0
fi
rand() { head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-40; }
cp .env.example .env
# Haslo bazy jest jedno: POSTGRES_PASSWORD oraz adresy DATABASE_URL i TEST_DATABASE_URL.
pg="$(rand)"
sed -i "s|^POSTGRES_PASSWORD=CHANGE_ME|POSTGRES_PASSWORD=${pg}|; s|:CHANGE_ME@|:${pg}@|" .env
# Pozostale CHANGE_ME (SESSION_SECRET, ADMIN_BOOTSTRAP_PASSWORD, REVALIDATE_SECRET) dostaja wlasne wartosci (hex).
while grep -q 'CHANGE_ME' .env; do
  value="$(rand)"
  sed -i "0,/CHANGE_ME/s//${value}/" .env
done
echo ".env utworzony z losowymi sekretami lokalnymi."
