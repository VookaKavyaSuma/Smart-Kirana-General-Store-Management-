# Project Requirements Document: Smart Kirana & General Store Management Website

**Document type:** Software Requirements Specification (SRS) **Version:** 1.1 (Revised: supplier-based model, individual project) **Date:** 14 November 2026

## 1. Introduction

### 1.1 Purpose

This document defines the requirements for a bilingual (Telugu and English) web application that helps a Kirana or general store owner record the stock bought from suppliers, keep the bills, track remaining stock, and see which items and suppliers give the most profit.

### 1.2 Scope

The system covers login, item and stock records, supplier (seller) records, bill storage with automatic reading of bills, unit and price conversion, search, profit reports, and profit-based item suggestions. It also records customer credit (debts), online money received from customers, and online payments made to suppliers. It has no payment gateway and no delivery.

### 1.3 Project Type

This is an individual project built, tested, and deployed by one developer. Choices in this document favour free or low-cost tools and simple designs that one person can maintain.

### 1.4 Definitions

| Term | Meaning |
| --- | --- |
| Supplier | The seller (wholesaler, distributor, retailer, or online seller) from whom the store buys goods. Only the shop name is stored. |
| Purchase | A stock purchase made by the store from a supplier on a given date. |
| Cost Price (CP) | Price at which the store buys one unit from the supplier. |
| Selling Price (SP) | Price at which the store sells one unit to its customers. |
| Quantity purchased | Units of an item bought from suppliers. |
| Quantity remaining | Units of that stock still in the store. |
| Profit | (SP − CP) × units, as defined in section 5.2. |

### 1.5 Assumptions

- The user is the store owner; one login is one store.
- "Items purchased" means goods the store buys from suppliers to sell, not goods bought by customers.
- Customers are recorded only for credit (debts). Other sales are not listed bill by bill: the owner updates the remaining stock by entering units sold (quick entry or stock count). Items given on credit reduce the remaining stock automatically.
- The owner enters data manually, or confirms data read automatically from a bill.

## 2. Overall Description

The application is used mainly on phones by store owners with limited technical experience, so it must be simple, mobile-first, and usable in Telugu or English.

| Item | Description |
| --- | --- |
| User | Store owner. Many devices (phone, shop tablet, home computer) can be logged in to the same account at once. |
| Devices | Android and iOS browsers, plus desktop Chrome, Edge, Firefox, and Safari. |
| Network | Must work on slow 4G connections. |
| Languages | Telugu and English, chosen by the user and remembered. |
| Developer | One person, part-time, using free-tier services where possible. |
| Currency | Indian rupees (₹). |

## 3. Functional Requirements

### 3.1 Registration, Login, and Sessions (FR-1)

| ID | Requirement |
| --- | --- |
| FR-1.1 | Registration shall ask for four values: shop name, user name, password, and mobile number. |
| FR-1.2 | The user name shall be the shop name with all spaces removed (for example, shop name "Sri Lakshmi Stores" gives user name "srilakshmistores"). The system shall fill it in automatically. |
| FR-1.3 | User names shall be case-insensitive. "SriLakshmiStores", "srilakshmistores", and "SRILAKSHMISTORES" are the same user name. The system shall store the lower-case form and compare in lower case at login. |
| FR-1.4 | If a user name is already taken, registration shall be refused with a message asking for a different shop name. |
| FR-1.5 | The mobile number shall be verified by OTP during registration. |
| FR-1.6 | The password shall be stored only as a salted hash. |
| FR-1.7 | Forgot password: the user enters the user name and mobile number, receives an OTP by SMS on that number, and sets a new password. OTPs shall expire in 10 minutes, be single use, and be limited to 5 wrong attempts and 3 requests per hour. |
| FR-1.8 | The session shall not expire. The user stays logged in on a device until the Logout button is pressed on that device. |
| FR-1.9 | The same account can be logged in on many devices at the same time. Logout on one device shall not log out the others. |
| FR-1.10 | The user shall be able to log out from all devices at once (FR-12). Changing or resetting the password shall also offer this option. |

### 3.2 Language and Voice Assistance (FR-2)

| ID | Requirement |
| --- | --- |
| FR-2.1 | The whole interface (menus, labels, messages, reports) shall be available in Telugu and English. |
| FR-2.2 | A language switch shall be visible on the login page and in settings. The choice is saved to the account and applies on every device. |
| FR-2.3 | Item names may be typed in Telugu or English and shall be searchable in either script. |
| FR-2.4 | Voice input: the user shall be able to speak to the search bar and to the item, price, and quantity fields in Telugu or English. |
| FR-2.5 | Voice commands shall include: "search rice", "how much sugar is left", "add item", and "profit this month". |
| FR-2.6 | Voice output: the assistant shall read answers aloud (stock left, price, monthly profit) in the chosen language. |
| FR-2.7 | A microphone button shall be shown next to the search bar. If the device does not support voice, the button is hidden and typing still works. |

### 3.3 Items and Stock (FR-3)

| ID | Requirement |
| --- | --- |
| FR-3.1 | The user shall enter an item manually with: name (Telugu or English), category, unit (kg, g, litre, ml, piece, packet), cost price, selling price, and quantity. |
| FR-3.2 | The user shall upload a photo of the item. Accepted formats are JPG and PNG, up to 5 MB each. The app shall shrink the photo before upload. |
| FR-3.3 | The user shall be able to edit or delete an item. |
| FR-3.4 | For each item the system shall store the quantity purchased (total bought from suppliers) and the quantity remaining. |
| FR-3.5 | The user shall reduce the remaining quantity by entering units sold (quick "sold" entry) or by typing a new stock count. Remaining quantity can never go below zero. |
| FR-3.6 | Buying more stock of the same item shall add to the quantity purchased and the quantity remaining, and shall keep the cost price of each purchase separately. |
| FR-3.7 | Items with remaining quantity below a limit set by the user shall be marked "low stock". |
| FR-3.8 | When an item is entered manually, the form shall ask for the supplier shop name. If a name is given, the item is filed under that supplier (a new supplier is created if the name is new). If left blank, the item goes under "No supplier" and can be moved later. |

### 3.4 Unit and Price Conversion (FR-4)

The conversion works in both directions and updates live as the user types.

| ID | Requirement |
| --- | --- |
| FR-4.1 | Quantity to price: if the user enters a quantity in kg, the system shall show the selling price for that quantity. Example: SP ₹60 per kg; 1 kg = ₹60, 1/2 kg = ₹30, 1/4 kg = ₹15, 100 g = ₹6. |
| FR-4.2 | Price to quantity: if the user enters an amount, the system shall show the weight or volume it buys. Example: SP ₹60 per kg; ₹10 buys 166.7 g. |
| FR-4.3 | A ready price chart for each loose item shall list the price of 1 kg, 1/2 kg, 1/4 kg, 100 g, and the weight for ₹5, ₹10, ₹20, ₹50, and ₹100. |
| FR-4.4 | The same rules apply to litres and millilitres. |
| FR-4.5 | Units shall convert correctly between kg and g, and between litre and ml, and results shall be rounded to 2 decimals for money and 1 decimal for weight. |
| FR-4.6 | The same calculation shall be available as a small calculator on the item page and through voice ("price of 250 grams sugar"). |

### 3.5 Suppliers and Purchases (FR-5)

| ID | Requirement |
| --- | --- |
| FR-5.1 | The user shall add a supplier (the seller who sells goods to the store) by shop name. For each supplier the app also keeps the items bought from that seller, their cost prices, and the profit on them (FR-5.7). |
| FR-5.2 | The user shall record each purchase with: supplier, purchase date, and one or more items with quantity, cost price, and selling price. |
| FR-5.3 | The purchase date defaults to today and can be changed. The date is stored with every purchase. |
| FR-5.4 | The system shall calculate the total amount paid to the supplier and the expected profit for each purchase. |
| FR-5.5 | The cost price and selling price at the time of purchase are saved with the purchase, so later price changes do not alter earlier profit figures. |
| FR-5.6 | The user shall view, filter (by date, supplier, item), edit, and delete past purchases. Stock shall be adjusted when a purchase is edited or deleted. |
| FR-5.7 | A supplier page shall show the shop name, every item bought from that seller with quantity, cost price, selling price, and profit (per item and total), the total spent with the seller, and the seller's bills. |

### 3.6 Bills and Automatic Reading (FR-6)

Automatic reading of a bill is possible. A vision or OCR service reads the photo or PDF and returns supplier name, date, items, quantities, and prices. Since handwritten and Telugu bills are read less accurately, the app always shows the result for the user to correct and confirm before saving.

| ID | Requirement |
| --- | --- |
| FR-6.1 | The user shall upload the supplier's bill for a purchase as a photo (taken with the phone camera), image, or PDF. |
| FR-6.2 | The user shall also upload documents for online purchases: invoice PDFs, order screenshots, and bills received by email or WhatsApp. Each is marked "Online" or "Shop". |
| FR-6.3 | Files shall be stored securely and viewable and downloadable later. Accepted formats: JPG, PNG, PDF, up to 10 MB each. |
| FR-6.4 | After upload the system shall read the bill automatically and extract: supplier shop name, bill number, bill date, item names, quantity, unit, cost price per unit, and bill total. |
| FR-6.5 | The extracted data shall be shown in an editable review screen, next to the bill image. Nothing is saved to stock until the user presses Confirm. |
| FR-6.6 | On Confirm the system shall create the purchase, create missing items and the supplier, and add the quantities to stock, using the bill date as the purchase date. |
| FR-6.7 | Extracted line items that match an existing item name shall be linked to it; others are suggested as new items. |
| FR-6.8 | The system shall compare the sum of the extracted lines with the bill total and warn if they differ. |
| FR-6.9 | If reading fails, the user can still save the bill and enter the data by hand. |
| FR-6.10 | Bills shall be found by supplier, date, bill number, or Online/Shop type. |

### 3.7 Search with Suggestions (FR-7)

| ID | Requirement |
| --- | --- |
| FR-7.1 | A search bar shall be available on every main page. Results appear instantly while typing. |
| FR-7.2 | Each result shall show the item photo, name, quantity remaining, selling price, and cost price. |
| FR-7.3 | When the user taps the search bar or types the first letters, the system shall suggest search words based on how often that user has searched for them before, most frequent first. |
| FR-7.4 | Every search the user performs or opens a result from shall add to its frequency count. |
| FR-7.5 | Search shall ignore letter case, accept part of a word, tolerate small spelling mistakes, and work for Telugu and English names. |
| FR-7.6 | Results and suggestions shall appear within 300 ms for up to 10,000 items. |
| FR-7.7 | The user shall be able to delete a suggestion from the history. |

### 3.8 Profit Analysis (FR-8)

| ID | Requirement |
| --- | --- |
| FR-8.1 | The dashboard shall show: total money spent on purchases (overall cost), total items purchased, total quantity remaining, value of remaining stock, expected profit, and profit earned on units sold. |
| FR-8.2 | The system shall calculate the profit per unit and profit margin for every item. |
| FR-8.3 | The system shall show the item with maximum profit and the item with minimum profit, with a ranked list of all items. |
| FR-8.4 | The system shall calculate the profit for each supplier (profit from the goods bought from that supplier) and show the supplier giving maximum profit and the supplier giving minimum profit. |
| FR-8.5 | The system shall show the total profit for any selected month and compare it with the previous month. |
| FR-8.6 | The system shall show the total amount spent with each supplier. |
| FR-8.7 | Reports shall be shown as simple charts (monthly profit, top and bottom items, supplier profit) and can be exported to CSV or PDF. |
| FR-8.8 | The dashboard shall also show the total credit due from customers and the online balance remaining (FR-10, FR-11). |

### 3.9 Suggested Items (FR-9)

| ID | Requirement |
| --- | --- |
| FR-9.1 | A separate "Suggested Items" section shall rank items by profit. |
| FR-9.2 | The ranking shall use profit margin, total profit, and how fast the item sells (units sold per week). |
| FR-9.3 | The section shall show three lists: items worth buying more of, fast-selling items running low, and low-profit or slow items to review. |
| FR-9.4 | Each suggestion shall show a one-line reason, for example "Margin 28%, sold 40 units this month". |
| FR-9.5 | The user shall choose the period: last 30 days, last 90 days, or all time. |
| FR-9.6 | The suggestion for the cheapest supplier of an item shall be shown when the item was bought from more than one supplier. |

### 3.10 Customer Credit / Debts (FR-10)

This is a separate section of the website for customers who take goods and pay later.

| ID | Requirement |
| --- | --- |
| FR-10.1 | A separate "Customer Credit" section shall be available from the main menu. |
| FR-10.2 | The user shall add a customer with a name (mobile number optional). |
| FR-10.3 | For each credit entry the user shall record: customer, item, quantity, cost price, selling price (filled from the item, editable), and the date taken (default today). |
| FR-10.4 | The system shall calculate the amount due for each entry (selling price × quantity) and show the cost and profit on it. |
| FR-10.5 | A credit entry shall reduce the item's remaining quantity. Quantity above the remaining stock shall not be accepted. Deleting an entry shall put the quantity back. |
| FR-10.6 | The user shall record payments from the customer (part or full), marked cash or online. A payment marked online shall also appear in the online transactions (FR-11). |
| FR-10.7 | Balance due = total of the customer's credit entries − payments received. |
| FR-10.8 | A customer page shall list all items taken (item, quantity, cost, date), all payments, and the balance due. |
| FR-10.9 | The customer list shall show each balance, be sortable by highest due, and be filterable by paid and unpaid. A total credit due figure shall be shown at the top. |
| FR-10.10 | Profit on credit items is counted on the date the items are given. The unpaid amount is shown separately as credit due. |

### 3.11 Online Payments (FR-11)

Customers pay the store online. The app keeps the online money received, the online money paid to suppliers, and the balance left.

| ID | Requirement |
| --- | --- |
| FR-11.1 | Daily online entry: the user shall enter the total online amount received for each day. There is one entry per date (default today), and it can be edited. |
| FR-11.2 | Online transactions: in a separate section the user may add individual transactions with date and time, amount, who paid (optional), reference number, and note. |
| FR-11.3 | The amount counted for a day is the daily entry. If there is no daily entry, it is the sum of that day's transactions. The app shall warn when a day's transactions add up to more than its daily entry. |
| FR-11.4 | Payments to suppliers: in a separate section the user shall enter each online payment made to a supplier, with supplier, amount, date, reference number, optional link to a purchase, and note. |
| FR-11.5 | The system shall calculate the remaining online amount = online amount received − online payments made to suppliers, for all time and for any chosen day, month, or date range. |
| FR-11.6 | The remaining online amount shall be shown on the dashboard and the Online Payments page, with a day-by-day running balance. |
| FR-11.7 | If a supplier payment is more than the remaining online amount, the app shall ask the user to confirm before saving. |
| FR-11.8 | Online payments received against customer credit (FR-10.6) shall be added to the online transactions automatically. |
| FR-11.9 | The supplier page shall show the total paid online to that supplier. |
| FR-11.10 | The user shall see day-wise and month-wise online totals, filter by date, and export to CSV. An optional daily reminder can ask the user to enter the day's online total. |

### 3.12 Settings and Profile Page (FR-12)

| ID | Requirement |
| --- | --- |
| FR-12.1 | A separate Settings page shall be reachable from the main menu on every screen. |
| FR-12.2 | The page shall show the profile: shop photo, shop name, user name, mobile number, language, and the date the account was created. Shop name and user name are read-only. |
| FR-12.3 | The user shall upload, change, or remove the shop photo (JPG or PNG, up to 5 MB). The photo is shown on the profile and the dashboard header. |
| FR-12.4 | Change password: the user enters the current password and the new password twice. The new password must have at least 8 characters. |
| FR-12.5 | Log out from this device: ends only the current session. |
| FR-12.6 | Log out from all devices: ends every session of the account, including this one, after a confirmation. |
| FR-12.7 | A list of logged-in devices (browser or device name, last used) shall be shown, each with its own Logout button. |
| FR-12.8 | The user shall change the language, the low-stock limit, and turn the daily online-entry reminder on or off. |
| FR-12.9 | Changing the mobile number shall require an OTP sent to the new number. |
| FR-12.10 | The user shall export all data to CSV and delete the account after confirming with the password and an OTP. |

## 4. Non-Functional Requirements

| Category | Requirement |
| --- | --- |
| Performance | Pages load in under 3 seconds on 4G; search and suggestions respond in under 300 ms; a bill is read within 15 seconds. |
| Security | HTTPS only; hashed passwords; protection against SQL injection, XSS, and CSRF; file type and size checks; bills and photos readable only by the owner. |
| Sessions | Long-lived device sessions kept in the database, each revocable by logout; session tokens in secure cookies. |
| Privacy | Each store sees only its own data. Bill files are never public links. |
| Usability | Mobile-first, large buttons, few steps, Telugu and English labels, voice input on main screens. |
| Reliability | Daily database backup; stock and profit must never go negative or inconsistent after edits. |
| Accuracy | Money stored as exact integers (paise) or fixed-precision decimals; never floating point. |
| Cost | Run on free or low-cost tiers during development and early use. |
| Maintainability | One code repository, clear folder structure, and API documentation so one developer can maintain it. |
| Compatibility | Latest two versions of Chrome, Edge, Firefox, and Safari. Voice features work best on Chrome (Android and desktop). |

## 5. Data Requirements

### 5.1 Main Entities

| Entity | Key fields |
| --- | --- |
| Store | id, shop name, user name (lower case, no spaces, unique), password hash, mobile number, language, shop photo |
| Session | id, store id, device name, created at, last used at, revoked |
| Supplier | id, store id, shop name |
| Item | id, store id, name (Telugu/English), category, unit, photo, current cost price, current selling price, quantity remaining |
| Purchase | id, store id, supplier id, purchase date, type (Online/Shop), total amount, bill file |
| PurchaseItem | id, purchase id, item id, quantity, cost price, selling price |
| StockAdjustment | id, item id, date, units sold or corrected |
| BillFile | id, purchase id, file path, extracted data (JSON), confirmed (yes/no) |
| SearchHistory | id, store id, search word, count, last searched at |
| OtpRequest | id, mobile number, code hash, purpose, expires at, attempts |
| Customer | id, store id, name, mobile number (optional) |
| CreditEntry | id, customer id, item id, item name, quantity, cost price, selling price, date taken |
| CreditPayment | id, customer id, amount paid, date, mode (cash/online) |
| DailyOnlineEntry | id, store id, date (one per day), total online amount received that day, note |
| OnlineTransaction | id, store id, date and time, amount received, from (customer name, optional), reference number, note |
| SupplierPayment | id, store id, supplier id, purchase id (optional), amount paid online, date, reference number, note |

### 5.2 Formulas

```latex
\text{Profit per unit} = SP - CP
\text{Margin \%} = \frac{SP - CP}{SP} \times 100
\text{Overall cost} = \sum (\text{quantity purchased} \times CP)
\text{Expected profit} = \sum (\text{quantity purchased} \times (SP - CP))
\text{Profit earned} = \sum (\text{units sold} \times (SP - CP))
\text{Quantity remaining} = \text{quantity purchased} - \text{units sold}
\text{Price for weight} = \text{SP per kg} \times \text{weight in kg}
\text{Weight for amount} = \frac{\text{amount}}{\text{SP per kg}} \text{ kg}
```

Monthly profit is the profit earned on units sold in that calendar month. Supplier profit is the profit earned on items bought from that supplier.

```latex
\text{Amount due per customer} = \sum (\text{selling price} \times \text{quantity taken}) - \sum \text{payments received}
\text{Remaining online amount} = \sum \text{online amount received} - \sum \text{online payments to suppliers}
\text{Profit of a supplier} = \sum (\text{units sold of its items} \times (SP - CP))
```

## 6. User Interface Screens

| Screen | Contents |
| --- | --- |
| Register / Login | Shop name, auto-filled user name, password, mobile number, OTP step, language switch |
| Forgot Password | User name, mobile number, OTP entry, new password |
| Dashboard | Search bar with mic, total cost, expected profit, profit earned, this month's profit, low-stock list |
| Items | Photo grid or list, add and edit item, units sold entry, price chart and calculator |
| Purchases | New purchase form, supplier selection, date, item lines, bill upload |
| Bill Review | Bill image beside editable extracted data, Confirm button |
| Bills | All bills with Online/Shop filter, supplier and date filters, view and download |
| Suppliers | Shop names with total spent and profit from each |
| Reports | Maximum and minimum profit items and suppliers, monthly profit, export |
| Suggested Items | Three ranked lists with reasons |
| Settings | Shop photo and profile, change password, log out from this device or all devices, language, low-stock limit, logged-in devices |
| Customer Credit | Customer list with amount due, items taken, add credit, record a payment |
| Online Payments | Daily online entry, online transactions, payments to suppliers, remaining online balance |

## 7. Recommended Technology Stack

For one developer, use JavaScript end to end (React plus Node.js) with a managed PostgreSQL database and hosted services for SMS, file storage, and bill reading. This keeps the code in one language and avoids running servers by hand.

| Layer | Technology | Why |
| --- | --- | --- |
| Frontend | React with Vite, as a Progressive Web App (PWA) | Fast UI, instant search, installable on a phone home screen, works on slow networks |
| Styling | Tailwind CSS | Quick mobile-first design |
| Telugu and English | react-i18next, with Noto Sans Telugu font | Language files for each screen; the language choice is saved to the account |
| Voice assistant | Web Speech API (speech recognition and speech synthesis), language codes te-IN and en-IN | Free, built into Chrome on Android and desktop; no extra server. Telugu speech output depends on a Telugu voice installed on the device, so keep text on screen too |
| Charts | Recharts | Monthly profit and ranking charts |
| Backend | Node.js with Express (TypeScript optional) | Simple REST API |
| Database | PostgreSQL on Supabase or Neon (free tier) | Exact money values, group-by queries for profit by item, supplier, and month |
| ORM | Prisma | Easy schema changes and type safety |
| Login and sessions | Own login with bcrypt or argon2; random session token saved per device in a sessions table and sent as a long-lived secure cookie | Gives sessions that last until logout and many devices at once, and each device can be revoked |
| OTP by SMS | Firebase Phone Authentication, or an Indian SMS provider such as MSG91 or Twilio Verify | Sends and checks OTP on the mobile number. Indian SMS providers need sender and template registration (DLT); check current prices and free limits before choosing |
| File storage | Supabase Storage or Cloudinary | Item photos and bill files, with private access for bills |
| Automatic bill reading | Claude vision API (reads photos and PDFs and returns structured JSON); free fallback Tesseract.js with Telugu and English data | Vision models handle varied layouts and mixed Telugu and English better than plain OCR. Cost is small per bill and the user confirms results |
| Search | PostgreSQL pg\_trgm index plus a SearchHistory table | Instant partial and spelling-tolerant search; frequency counts power suggestions |
| Validation | Zod | One set of rules for forms and API |
| Hosting | Vercel or Netlify (frontend), Render or Railway (backend) | Free or low-cost tiers, deploy from GitHub |
| Testing | Vitest or Jest, Playwright | Unit tests for profit and conversion formulas, end-to-end tests for login and bill flow |

**Alternative:** Django with Django REST Framework and PostgreSQL, if Python is the developer's stronger language. It gives login and an admin panel quickly, but the frontend still needs React or similar for instant search and voice.

## 8. Build Plan for One Developer

About 17 weeks working part-time (15 to 20 hours a week). Each phase ends with something that works, so the project is usable early.

1. **Weeks 1–2, Setup and login:** repository, database schema, registration, user name rule, login, OTP reset, long-lived multi-device sessions.
2. **Weeks 3–4, Items and suppliers:** item form with photo upload and supplier shop name, supplier pages with items, cost price, and profit, stock fields, Telugu and English language files.
3. **Weeks 5–6, Purchases and conversion:** purchase entry with date, quantity purchased and remaining, units-sold entry, kg, 1/2 kg, and rupee-amount calculator.
4. **Weeks 7–8, Bills:** shop and online bill upload, bill viewer, bill search.
5. **Weeks 9–10, Automatic bill reading:** extraction, review screen, confirm to stock.
6. **Week 11, Search and voice:** instant search, frequent-search suggestions, voice input and spoken answers.
7. **Week 12, Settings page:** profile, shop photo, change password, logout from this device and all devices, device list.
8. **Week 13, Customer credit:** customers, items taken on credit, payments, balance due.
9. **Week 14, Online payments:** daily online entry, transactions, supplier payments, remaining online balance.
10. **Week 15, Profit reports:** maximum and minimum items and suppliers, monthly profit, charts.
11. **Week 16, Suggested items:** scoring and the three lists.
12. **Week 17, Testing and launch:** formula tests, device tests, security check, deployment, backup.

## 9. Acceptance Criteria

- A user registers with shop name "Sri Lakshmi Stores", gets user name "srilakshmistores", and can log in with "SRILAKSHMISTORES".
- The password is reset with an OTP sent to the registered mobile number.
- The same account stays logged in on two phones at once, and after closing and reopening the browser, until Logout is pressed.
- Switching to Telugu changes every screen; the choice stays after logout and login.
- Saying "search sugar" in Telugu or English shows the item photo, name, quantity, selling price, and cost price.
- Typing "s" in search shows the user's most frequently searched words first.
- For an item at ₹60 per kg, the app shows ₹30 for 1/2 kg and 166.7 g for ₹10, and the reverse.
- A photographed supplier bill is read, shown for review, and on Confirm adds the items to stock with the bill date.
- An online invoice PDF can be uploaded and found later by supplier name.
- Dashboard totals match a hand calculation on sample data, and the maximum and minimum items and suppliers and the monthly profit are correct.
- The Suggested Items page shows ranked items with reasons.
- Adding an item manually asks for the supplier shop name and files the item under that supplier, and the supplier page lists its items with cost price, quantity, and profit.
- A customer takes 2 items on credit; the stock drops by 2, the customer's balance shows the amount due, and a part payment lowers the balance.
- Entering ₹5,000 as the online amount for a day and a ₹2,000 online payment to a supplier shows ₹3,000 as the remaining online amount.
- Settings shows the profile and shop photo; changing the shop photo and password works; Log out from all devices ends the session on every phone, while Log out from this device ends only the current one.

## 10. Risks and Mitigation

| Risk | Mitigation |
| --- | --- |
| Bill reading makes mistakes, especially on handwritten or low-light photos | Always show a review screen; warn when line totals differ from the bill total; allow manual entry |
| Two shops have the same name, so the same user name | Refuse the duplicate and ask for a different shop name (see open questions) |
| "Never expire" sessions leave a lost phone logged in | Show logged-in devices in settings with a Logout option; revoke all sessions on password reset |
| SMS OTP cost or delivery problems in India | Pick a provider with DLT support; set request limits; test on several networks |
| Telugu voice recognition or speech is weak on some phones | Keep typing always available; show answers on screen as well as speaking them |
| Bill reading cost grows with use | Compress images, read each bill once, offer the free Tesseract fallback |
| One developer, limited time | Build in phases, ship the core (items, purchases, search, profit) first |

## 11. Future Enhancements

- Barcode scanning when adding stock
- Low-stock alerts by SMS or WhatsApp
- Supplier-wise price comparison for the same item
- GST-ready purchase records
- Offline mode with later sync
- Demand forecasting for suggestions

## 12. Open Questions

1. **Sold units:** since customers are not recorded, is entering units sold (or a stock count) acceptable for reducing remaining stock and measuring profit earned?
2. **Duplicate shop names:** should registration refuse a name already taken, or add the last digits of the mobile number to the user name?
3. **Supplier details:** is the shop name alone enough, or should a supplier phone number be added later?
4. **Bill reading budget:** is a paid vision service acceptable for reading bills, or should the free Tesseract option be the default?
5. **Unit rule:** should price be shown for 1/2 kg and 1/4 kg only, or also for custom weights the user types?
6. **Credit and profit:** is it correct to count profit on credit items when they are given (not when the customer pays)?
7. **Online balance:** should the remaining online amount subtract only online payments to suppliers, or also other online expenses such as rent or electricity bills?
8. **Daily entry and transactions:** if the owner enters both a daily total and single transactions for the same day, is the daily total the figure to trust (as assumed)?
