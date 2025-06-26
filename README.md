# CerNFT-App

## Step by step Membuat Rust Smart Contract Dapp pada Solana:

1. Buat Contract Architecture/Diagram
2. Project Setup (Persiapkan template code atau instalasi)
3. Pecah contract code/ split code pada anchor
4. Initialize states pada smart contract
5. Buat smart contract sesuai fitur-fitur di Contract Architecture/Diagram
6. Initialize script atau buat script/init.ts
7. Buat code test pada setiap fitur-fitur
8. Buat code user test


## Step by step Membuat Frontend Dapp pada Solana dengan React.js:

1. Buat code untuk connect wallet
2. Integrasikan code smart contract pada frontend
3. Buat code frontend sesuai fitur-fitur yang ada
4. Setelah selesai semua, lakukan live deployment


## Perintah Template Dapp Solana:

npx create-solana-dapp@latest

## Perintah buat folder anchor:

anchor init [nama_project]


## Cara Contract Deployment

1. cd anchor/
2. anchor build
3. solana-test-validator --reset
4. solana config get
5. solana config set --url localhost
6. anchor build && anchor deploy

Kalau belum punya pubkey:

1. solana-keygen new


Proses Komplit untuk Debugging dan Perbaikan:

1. Pastikan validator berjalan
Terminal 1:
solana-test-validator --reset

2. Konfirmasi validator merespons
Terminal 2:
solana config set --url localhost
solana validators

3. Bangun dan deploy program
anchor clean
anchor build
PROGRAM_ID=$(solana address -k target/deploy/cernft-keypair.json)
echo "Program ID: $PROGRAM_ID"

4. Perbarui Anchor.toml dengan Program ID yang benar
Edit manual atau gunakan sed:
sed -i "s/cernft = \".*\"/cernft = \"$PROGRAM_ID\"/" Anchor.toml

5. Deploy program
anchor deploy

6. Verifikasi program ada di jaringan
solana program show $PROGRAM_ID

7. Baru jalankan script inisialisasi
npx esrun scripts/init.ts

8. Test untuk smart contract
anchor test --skip-local-validator --skip-deploy