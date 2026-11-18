# Team Workspace — Private Team Management Platform

> **შიდა სამუშაო სივრცე (Private Team Workspace)** — მაღალი საიმედოობის, თვითჰოსტირებადი სამუშაო პლატფორმა 5–10-წევრიანი გუნდისთვის (Developers, Content, Designers, QA და Team Leads).  
> სისტემა უზრუნველყოფს თანამიმდევრულ სამუშაო პროცესს (Sequential Workflow), დედლაინების მკაცრ ადმინისტრაციულ კონტროლს, რეალურ დროში დატვირთვის მონიტორინგს და სრულ ქართულენოვან ინტერფეისს.

---

## 🌟 ძირითადი ფუნქციონალი (Key Features)

- **თანამიმდევრული ეტაპები (Sequential Workflow Stages):**  
  დავალებების გადაცემა ეტაპობრივად (მაგ. *დიზაინი -> Development -> QA*). აქტიური ეტაპის დასრულებისთანავე პასუხისმგებლობა ავტომატურად გადადის მომდევნო შემსრულებელზე.
- **დედლაინების მმართველობა (Deadline Governance):**  
  ინიციალურ ვადას განსაზღვრავს შემქმნელი/შემსრულებელი; დაფიქსირების შემდეგ დედლაინის შეცვლა შეუძლია **მხოლოდ ადმინისტრატორს**, მიზეზის სავალდებულო დაფიქსირებით (ან მომხმარებლის მოთხოვნის დადასტურებით).
- **ღია გუნდური კოლაბორაცია (Open Task Collaboration):**  
  ყველა აქტიურ მომხმარებელს შეუძლია დავალებების შექმნა, რედაქტირება და როგორც საკუთარ თავზე, ისე გუნდის სხვა წევრებზე მინიჭება.
- **სამი დეპარტამენტი და ხარისხის კონტროლის რეესტრი (Development, Content & QA):**  
  დეველოპმენტის, კონტენტისა და ხარისხის კონტროლის (`QA`) ნაკადების იზოლაცია. `QA & Testing` სექცია წარმოდგენილია სპეციალიზებული ერთხაზიანი მატრიცული რეესტრით (სამუშაო ეტაპებისა და კანბანის გარეშე), სწრაფი ვერიფიკაციის ჩეკლისტებითა და ბოლო ტესტირების თარიღების კონტროლით.
- **მომხმარებლების დეაქტივაცია და წაშლა (User Lifecycle & Task Reset):**  
  მომხმარებლის დეაქტივაციის ან წაშლისას (Soft Delete) მისი მიმდინარე (არადასრულებული) დავალებები და აქტიური ეტაპები ავტომატურად თავისუფლდება მინიჭებისგან და უქმდება აქტიური დედლაინები, ხოლო არქივში (დასრულებულ ტასკებსა და ისტორიაში) სრულად ნარჩუნდება შემსრულებლის სახელი და გვარი.
- **ვერტიკალური თაიმლაინი (Vertical Timeline):**  
  დავალებების ვიზუალური განაწილება კალენდარულ ღერძზე ორ რეჟიმში: *Schedule Mode* (დაგეგმილი) და *Activity Mode* (რეალური ისტორიული მოვლენები). თითოეულ ბარათზე მკაფიოდ ჩანს დავალების კატეგორია (`ტესტირება / QA`, `ბაგ-ფიქსი`, `ჰოთფიქსი`, `ფიჩერი`) და დეპარტამენტი. ითვალისწინებს ოფიციალურ ქართულ უქმეებსა და არასამუშაო დღეებს.
- **დატვირთვის მართვა (Workload & Capacity):**  
  გუნდის წევრების დატვირთვის მონიტორინგი, კონფლიქტებისა და გადაფარვების დროული იდენტიფიცირება.
- **დინამიური რეპორტები და ანალიტიკა (Reports & Analytics):**  
  ვადების დაცვის რეალური დინამიური პროცენტულობა (On-Time Delivery Rate), გადაცილებული ტასკების ზუსტი ასახვა და ქართული კალენდარული თვეების ფილტრი.
- **შეუქცევადი აუდიტის ლოგი (Append-Only Audit Log):**  
  ყველა მოქმედების (შექმნა, სტატუსის ცვლილება, ეტაპების გადაცემა, წაშლა, ბმულების დამატება) უცვლელი ისტორიული ჩანაწერი.
- **დამოუკიდებელი ბმულები და ფაილები (Attachments & Links):**  
  შიდა დაცული ფაილების ატვირთვა და გარე ბმულების (Figma, GitLab, Docs) მიბმა არასავალდებულო სათაურით.

---

## 🛠 ტექნოლოგიური სტეკი (Tech Stack)

| კომპონენტი | ტექნოლოგია |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack, React 19) |
| **Language** | TypeScript (Strict Mode) |
| **Styling** | Tailwind CSS + Lucide Icons |
| **Database & ORM** | PostgreSQL 16 + Prisma ORM |
| **Authentication** | Server-Side HTTP-Only Cryptographic Sessions + bcryptjs |
| **Validation** | Zod Schema Validation |
| **Timezone** | `Asia/Tbilisi` (UTC+4) |
| **Containerization** | Docker & Docker Compose |

---

## 🚀 სწრაფი დაწყება (Quick Start)

### 1. წინაპირობები (Prerequisites)
- [Node.js](https://nodejs.org/) (v20 ან უფრო ახალი)
- [Docker](https://www.docker.com/) და Docker Compose

### 2. გარემოს კონფიგურაცია (.env)
შექმენით `.env` ფაილი პროექტის ძირში:

```env
DATABASE_URL="postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_db?schema=public"
SESSION_SECRET="team-workspace-secure-session-key-5a693990-2026-tbilisi"
NEXT_PUBLIC_TIMEZONE="Asia/Tbilisi"
PORT=3000
```

### 3. ბაზის გაშვება Docker-ში
```bash
docker compose up -d
```
ბაზა გაეშვება `5434` პორტზე (`team_workspace_postgres` კონტეინერი).

### 4. დამოკიდებულებების ინსტალაცია და მიგრაცია
```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

### 5. დეველოპმენტ სერვერის გაშვება
```bash
npm run dev
```
პლატფორმა ხელმისაწვდომია მისამართზე: [http://localhost:3000](http://localhost:3000)

---

## 🔑 ადმინისტრატორის საწყისი მონაცემები (Admin Credentials)

სისტემის საწყისი ინსტალაცია შეიცავს ერთადერთ სუფთა ადმინისტრატორს:

- **ელ-ფოსტა (Email):** `admin@team.local`
- **საწყისი დროებითი პაროლი (Initial Password):** `admin123` *(გთხოვთ შეცვალოთ პირველივე შესვლისთანავე)*
- **როლი (Role):** `ADMIN`

ავტორიზაციის შემდეგ ადმინისტრატორს შეუძლია მომხმარებლების მართვის პანელიდან (`/admin/users`) დაამატოს გუნდის წევრები.

---

## 🧪 ტესტირება და უსაფრთხოება (Testing & Safety)

პროექტში დანერგილია მკაცრი მონაცემთა იზოლაცია:

- **ტესტების გაშვება (Unit & Integration Tests):**
  ```bash
  npm test
  ```
- **ავტომატური ბრაუზერის Smoke ტესტები (Puppeteer E2E Smoke Suite):**
  ```bash
  npm run test:smoke
  ```
- **უსაფრთხოების გარანტია (Fail-Closed Isolation):**  
  ავტომატური ტესტები მკაცრად უერთდება მხოლოდ გამოყოფილ სატესტო ბაზას (`team_workspace_test_db`). სატესტო გარემოს კონექტორი პროგრამულად ბლოკავს (`throw Error`) მთავარ საწარმოო ბაზასთან (`team_workspace_db`) ნებისმიერ შეერთებას.
- **ტიპების შემოწმება & ლინტინგი:**
  ```bash
  npx tsc --noEmit
  npm run lint
  ```
- **Production Build:**
  ```bash
  npm run build
  ```

---

## 📁 დოკუმენტაცია (Documentation)

სრული დოკუმენტაცია იხილეთ `docs/` დირექტორიაში:
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — **კოდის სტრუქტურა და პატერნები (სავალდებულო წესები: Route → Action → Repository, Modules, DTO, Policy, Resource).**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — სისტემური არქიტექტურა, სერვისები და ბიზნეს წესები.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — მონაცემთა მოდელი, ER დიაგრამა და Prisma სქემა.
- [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md) — პროდუქტის მოთხოვნები და როლების მატრიცა.
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — იმპლემენტაციისა და სტაბილიზაციის გეგმა.
