# The admin's custom scenarios (demo)

`admin_custom_scenarios.json` holds the scenarios the demo's administrator, a cybersecurity specialist, wrote
by hand. It is not a public dataset, and **none of it is used for any result reported in the paper**.
`DEMO_AUTHOR_WRITTEN=off` in `backend/.env` leaves it out.

| What | Detail |
| --- | --- |
| Size | 108 South African scenarios, phishing **and** genuine: 64 emails (4 + 4 in General and Banking & Money, 3 + 3 in the other 8 categories) and 44 texts (4 + 4 in Banking & Money, Account Security, Delivery and Government; 3 + 3 Prizes & Offers; 2 + 2 Employment; 1 + 1 University) |
| How the demo loads it | Added the way the Scenario Review "Create scenario" form adds a scenario (no dataset), then approved and switched on. In Scenario Review they are the `admin_custom_scenarios` group, and every scenario the admin creates later joins the same group |
| Share of what players see | Most of it. With these loaded, only 1 phishing and 1 genuine draft per category go live from each channel's datasets (2 KD emails, 20 Combined texts), and only where the category has both answers |

## Why they exist

A category can be picked for focused practice only when its live scenarios hold both answers, otherwise a player
could answer from the category label alone.

- The public email datasets cannot do this. The KD set's phishing is about accounts, IT, prizes and government,
  but its genuine emails are all meeting notes. Nazario, Nigerian_Fraud and `phishing_dataset_with_category.csv`
  are phishing only, and the "genuine" emails in SpamAssassin and CEAS_08 are 2000s mailing-list threads whose
  label 1 is marketing spam rather than phishing (checked 17 and 18 October 2026).
- The dataset messages are plain: KD emails have no links or attachments, so a player can never hover a link or
  "open" a file. The custom scenarios have real-looking senders, links and attachments.
- None of the public datasets is South African. These cover the scams South Africans actually receive: bank
  suspensions and fraud alerts, fake proof of payment, a supplier's "new banking details", SARS refunds and
  penalties, SASSA SRD grants, traffic fines, PUDO and courier fees, NSFAS allowances, retail job "registration
  fees", Smart Shopper, Vodacom and MTN prizes, the WhatsApp code hijack, SIM-swap texts and a "director" asking
  for gift cards. Each comes with genuine messages of the same kind from the real senders (fnb.co.za,
  capitecbank.co.za, sars.gov.za, takealot.com, pudo.co.za, nsfas.org.za and so on).

## How they were written

- Every category has as many genuine as phishing items, in both channels.
- Senders, subjects and links are written as each kind really looks: look-alike domains for phishing, the
  organisation's real domain for genuine messages. Every web address is a full `https://` link, so the message
  view shows it as a link (hovering shows where it goes, and clicking counts as trusting the message). Genuine
  messages link to real sites too (SARS eFiling, PUDO, Takealot, SASSA, NSFAS, City Power), so a link alone
  never gives the answer away.
- Some genuine messages are alarming on purpose (a bank fraud alert, a new-device warning, a SARS final
  reminder, an uncollected parcel), so Hard messages are not all phishing.
- The category is the admin's choice; warning signs, difficulty and realism follow the same rules as an import.
- Fictional people and numbers only. The only phone numbers are banks' published share-call lines (0860) and
  SAPS 10111.

Unit tests (`tests/test_admin_custom_scenarios.py`) check that every item passes every automatic review check,
that every phishing item shows at least one warning sign, that each category is balanced, and that titles are
unique.
