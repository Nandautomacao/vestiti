# Vestiti: loja online + sistema de estoque

Este projeto é só da Vestiti, separado do Açaí da Promeca, com banco e endereço próprios.

| Endereço | O que é | Quem usa |
|---|---|---|
| `seu-site.vercel.app` | Catálogo da loja, com pedido pelo WhatsApp | Clientes |
| `seu-site.vercel.app/admin/` | Sistema de estoque, vendas e lucro | Só você (com login) |

## Pastas
- Raiz (`index.html`, `app.js`, `styles.css`, `config.js`): o catálogo da loja
- `admin/`: o sistema de estoque
- `supabase/setup.sql`: cria o banco (tabelas, segurança, catálogo e fotos)
- `vercel.json`: garante que `/admin` abra o sistema corretamente

## Colocar no ar
1. **Supabase:** crie um projeto novo chamado `vestiti`, na região São Paulo. No **SQL Editor**, rode o arquivo `supabase/setup.sql` inteiro.
2. **Chave:** clique em **Connect** e copie a URL e a chave `sb_publishable_...`. Cole as duas nos dois arquivos de configuração: `config.js` (na raiz) e `admin/config.js`.
3. **GitHub:** crie o repositório `vestiti` e suba **tudo**, incluindo as pastas `admin` e `supabase`.
4. **Vercel:** clique em **Add New → Project**, importe o `vestiti`, escolha **Other** e clique em **Deploy**.
5. **Login:** no Supabase, abra **Authentication → URL Configuration**. Em **Site URL** e em **Redirect URLs**, coloque `https://SEU-ENDERECO.vercel.app/admin/`.
6. **Conta:** abra `/admin/`, crie sua conta, confirme pelo e-mail e entre. Depois desative novos cadastros em **Authentication → Sign In / Providers → Allow new users to sign up**.
7. **Peças:** cadastre as peças com foto e marque **Mostrar no catálogo**. Elas aparecem na loja na hora.
