# Demo-only content (author-written)

Nothing in this folder is a public dataset, and **none of it is used for any result reported in the paper**.
It was written by hand so the demo works well; `DEMO_AUTHOR_WRITTEN=off` in `backend/.env` leaves all of it out.

| File | What it is | How the demo loads it |
| --- | --- | --- |
| `demo_only_author_written_genuine_email.csv` | 56 genuine emails in the KD format: Account Security 12, Email & IT 12, Prizes & Offers 12, Government 12, Social Media 8 | Uploaded like any dataset (it shows on the Datasets page under this name), and paired with KD phishing in the replayed review |
| `sa_admin_scenarios.json` | 100 South African scenarios, phishing **and** genuine: 64 emails (4 + 4 in General and Banking & Money, 3 + 3 in the other 7 categories) and 36 texts (3 + 3 in most categories) | Added as the admin's own scenarios (no dataset, like the "Create scenario" form), then approved and switched on. They show in Scenario Review under "Added by hand or demo data" |

## Why they exist

A category can be picked for focused practice only when its live scenarios hold both answers, otherwise a player
could answer from the category label alone.

- **SMS** no longer needs help: `sms/Combined-Labeled-Dataset.csv` has real genuine texts in every category.
- **Email** does. The KD set's phishing is about accounts, IT, prizes and government, but its genuine emails are
  all meeting notes. The other email files were checked on 17 and 18 October 2026 and do not help. Nazario,
  Nigerian_Fraud and `phishing_dataset_with_category.csv` are phishing only. The "genuine" emails in SpamAssassin
  and CEAS_08 are 2000s mailing-list threads (Linux, Postfix, Python, SpamAssassin) that merely mention a
  keyword, and their label 1 is marketing spam rather than phishing.
- None of the public datasets is South African. The admin's scenarios add the scams South Africans actually
  receive: bank suspensions, fake proof of payment, a supplier's "new banking details", SARS refunds, SASSA SRD
  grants, traffic fines, PostNet, PUDO and Courier Guy fees, NSFAS allowances, retail job "registration fees",
  Smart Shopper, Vodacom and MTN prizes, the WhatsApp code hijack and SIM-swap texts. Each comes with genuine
  messages of the same kind from the real senders (fnb.co.za, capitecbank.co.za, sars.gov.za, takealot.com,
  pudo.co.za, nsfas.org.za and so on).

## How they were written

- **Genuine KD-format emails:** labelled genuine only, so all their categories' phishing comes from KD. They copy
  KD's format so style never gives the answer away: a short body with an opener, a one-line second paragraph,
  a "Team,\nName" or "Regards,\nName" sign-off with KD's names, no subject line, no sender column and no links.
  Subject and sender are worked out exactly as for KD phishing. Median length is 231 characters (KD phishing 209).
- **South African scenarios:** every category has as many genuine as phishing items. Senders, subjects and links
  are written as each kind really looks: look-alike domains for phishing, real domains for genuine messages.
  The category is the admin's choice; warning signs, difficulty and realism follow the same rules as an import.
- Fictional people and numbers only. The only phone number is a bank's published share-call line (0860).

Unit tests (`tests/test_demo_only_datasets.py`) check that every row passes every automatic review check, that
every South African phishing item shows at least one warning sign, and that each category is balanced.
