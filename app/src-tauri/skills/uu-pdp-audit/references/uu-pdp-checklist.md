# UU PDP checklist for a code review

Law No. 27 of 2022 on Personal Data Protection, in force from 17 October 2022. Article numbers are Pasal. The controller (*Pengendali*) decides why and how data is processed; the processor (*Prosesor*) works for the controller. The "agency" (*lembaga*) is the supervisor the law creates.

**Where this comes from (read 2026-11-24).** The article text was read on a public site that lists the law article by article (pasal.id). It is not the official gazette, and the official PDF could not be read as text. Treat every number below as "read on a secondary page" until a person checks it against the official text on the government law site (JDIH). The explanation sections (*Penjelasan*) were not readable. Whether the implementing government regulations (*PP*) the law promises now exist was not verified, and neither was whether the agency has been set up. Tell the owner to check both before giving a firm answer on fines, DPO rules or transfers.

**Three deadlines, all 3 x 24 hours from the request or the event.** Answering a request to correct (Pasal 30), giving access (Pasal 32), stopping on withdrawal of consent (Pasal 40), and restricting processing (Pasal 41) are each 3 x 24 hours. A data failure must be notified within 3 x 24 hours (Pasal 46). The law does not say when the count starts.

## What to look for, area by area

For each area: what the law asks, where to look, and what usually fails. "Code" means the project's own files. If the code cannot show it, the answer is "Cannot tell".

### 1. What is collected and why (Pasal 16(2), 27, 28)
- Law: collection is limited, specific, lawful and transparent; processing matches the stated purpose.
- Look: every field in sign-up and profile forms, every model column with personal data, every log line that holds a person's data.
- Fails: fields nobody uses (religion, ID number, date of birth "just in case"), data kept for a purpose the user was never told, free-text logs with names or phone numbers.

### 2. Legal basis and consent (Pasal 20, 21, 22, 23, 24)
- Law: there must be a legal basis. Six exist: explicit valid consent for stated purposes, a contract with the person, a legal duty, protecting vital interests, public interest or authority, and other legitimate interests weighed against the person's rights. When the basis is consent, tell the person: the legal basis, purpose, kind and relevance of the data, how long the documents are kept, what exactly is collected, how long it is processed, and their rights (Pasal 21(1)). If any of that changes, tell them before the change (Pasal 21(2)). Consent is written or recorded, on paper or electronic (Pasal 22(1) to (3)). When one request covers several matters, the consent request must be clearly separate, easy to find and in simple clear language, or it is void (Pasal 22(4), (5)). A contract clause that takes data without valid consent is void (Pasal 23). The controller must be able to prove consent (Pasal 24).
- Look: the sign-up flow, a consent table or flag with time, version of the text and what was agreed, whether a box is pre-ticked, whether marketing is bundled into the service terms, whether consent can be shown later.
- Fails: one tick for everything, a pre-ticked box, no record of which text the person agreed to, consent hidden in the terms, marketing mail to people who only signed up for the service.

### 3. Children and people with disabilities (Pasal 25, 26)
- Law: children's data (a specific category) and data of people with disabilities need special handling and consent from a parent or guardian.
- Look: age questions, school or family features, any "student" or "kid" role.
- Fails: a product that is used by children and has no parent step and no age rule.

### 4. People's rights (Pasal 5 to 15, 29, 30, 32, 40, 41, 43, 44, 45)
- Law: a person may ask for information (5), correction (6), access and a copy (7), deletion or destruction (8), withdrawal of consent (9), objection to purely automated decisions (10), a pause or limit (11) and a portable copy (13). Requests are made as a recorded request, electronic or not (14). A few rights stop applying for defence, law enforcement, public administration, supervision of finance, statistics and research (15). The controller answers within 3 x 24 hours where the law says so (see above) and tells the person the result (30(2), 41(3), 45).
- Look: an export of the person's data, a way to correct it, delete the account, withdraw consent, and a place where requests are recorded with a time. For an export, check that the requester owns the data (a person must not read someone else's record by changing an id in the address).
- Fails: deletion that only hides the account, no export, an export that leaks another person's data, a request channel that is an unread mailbox, a profile that cannot be corrected.

### 5. Keeping and ending (Pasal 16(2)g, 42, 43, 44, 45)
- Law: stop processing when the retention period ends, the purpose is met or the person asks. Delete when no longer needed, when consent is withdrawn, on request, or when the data was obtained unlawfully. Destroy as the law says. Tell the person about deletion.
- Look: a stated retention period for each kind of data, a scheduled clean-up job, what happens to backups, logs and copies in other systems, what remains after "delete account".
- Fails: no retention period, a clean-up job that is not scheduled, deleted users still in logs, exports and the analytics tool.

### 6. Security of the data (Pasal 16(2)e, 35, 36, 37, 38, 39)
- Law: technical and operational measures sized to the risk, confidentiality, supervision of everyone who touches the data, protection from unlawful processing, and a reliable system that prevents unauthorised access.
- Look: password storage (a slow hash such as argon2 or bcrypt, not a quick hash), encryption of sensitive fields and of traffic and backups, who may read which records (not only "is logged in"), an access trail for sensitive records, keys kept out of the code (use `find-secrets`), personal data in logs and error messages, admin screens.
- Fails: plain-text ID numbers, one role that reads everything, secrets in the repository, stack traces with personal data shown to users.

### 7. A data failure (Pasal 46)
- Law: when protection fails (a leak, loss or damage of confidentiality, integrity or availability, on purpose or not), tell the person and the agency in writing within 3 x 24 hours. The notice says at least: which data, when and how, and what is being done to handle and recover. In certain cases the public must be told too.
- Look: how a leak would be noticed (alerts, logs), who decides, whether there is a way to lock sensitive access fast, and a written plan with names. A plan is not code: say "Cannot tell" unless a document exists. Offer `incident-response` for the plan.
- Fails: nobody would notice, no contact for the agency, no template for the notice.

### 8. Records and proof (Pasal 31, 34, 47)
- Law: record the processing activities; carry out an impact assessment (DPIA) where the risk is high, including automated decisions with significant effect, specific data, large scale, systematic monitoring, combining datasets, new technology; be able to show accountability.
- Look: a list of what is processed and why, a written assessment for a high-risk feature (a facial scan, a credit score, tracking), audit trail tables.
- Fails: nothing written, a high-risk feature shipped with no assessment.

### 9. Other parties that touch the data (Pasal 37, 51, 52)
- Law: a processor works only on the controller's orders; the controller stays responsible; a processor needs written approval before bringing in another; the security duties apply to processors too.
- Look: every third-party service in the code (payments, email, analytics, maps, error tracking, cloud storage, an AI service), what personal data is sent to each, and whether a contract is mentioned in the repo or the docs.
- Fails: a tracker or error tool receiving names and emails; a vendor nobody listed.

### 10. Data leaving Indonesia (Pasal 55, 56)
- Law: transfer abroad needs the receiver's country to protect the data equally or better; if not, binding safeguards; if not, the person's consent.
- Look: the region of the database, storage, email and analytics services, and any SDK that sends data to servers abroad.
- Fails: personal data sent to a service abroad with no safeguard and nothing in the notice. Many cloud setups are abroad; this is a finding to report, not necessarily a breach.

### 11. A data protection officer (Pasal 53, 54)
- Law: needed when processing serves the public, when core activities need regular, systematic, large-scale monitoring, or when core activities process specific data or criminal-record data at scale. A Constitutional Court ruling (No. 151/PUU-XXII/2024) says the word "and" in Pasal 53(1) letter b must be read as "and/or", which can widen who needs an officer. The officer may be inside or outside the company. (The ruling is named on the BPK page for the law and was not read: to verify before relying on it.)
- Look: nothing in code. It is a company decision. Report "Cannot tell" and ask who the officer is, or why none is needed.

### 12. Notices in the product (Pasal 5, 21, 22(4))
- Law: the person must be told the basis, purpose, kinds of data, retention and rights, in plain language, before consent.
- Look: a privacy notice and terms exist, are linked at sign-up, and say what the code really does (compare them with the findings above).
- Fails: a notice copied from another company, a notice that promises encryption or deletion the code does not do. Offer `write-terms-and-privacy`.

## Penalties, so the owner sees the weight (Pasal 57, 65 to 70, 74)

Breaches of most duties in the law bring administrative sanctions: a written warning, a temporary stop of processing, deletion or destruction of the data, and a fine of up to 2 percent of yearly income or revenue tied to the breach (Pasal 57). Taking, disclosing or using someone's personal data unlawfully, and making false personal data, are crimes with prison up to 4 to 6 years and fines up to Rp4 to 6 billion; a company's fine can be up to 10 times that, with extra penalties such as freezing the business (Pasal 67 to 70). Companies had two years from the law's promulgation to adjust (Pasal 74), which ended on 17 October 2024 (my calculation from the promulgation date on the BPK page). Report this as context, not as a prediction.
