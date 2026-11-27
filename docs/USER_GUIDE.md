# GraceFlow — User Guide

GraceFlow is a church ministry scheduling app. It tells each servant when and where they serve, lets coordinators fill the schedule without clashes, and helps the church avoid burning out the same people.

Open it at **https://graceflow.id**. It runs in any phone or computer browser and can be installed like an app (see [Install the app](#install-the-app)).

---

## 1. Roles

Each person has one role per church. The menu (☰, top left) only shows the pages your role can use.

| Role | Who | Pages |
|---|---|---|
| **Servant** | Everyone who serves | Beranda, Jadwal, Ketersediaan, Profil |
| **Coordinator** | Leads one or more komisi (e.g. Musik, Multimedia) | Servant pages, plus **Atur Jadwal** and **Peran** |
| **Superadmin** | Church admin | All pages, plus **Admin** |

A person can belong to more than one church and switch between them from the menu.

---

## 2. Getting started

### Sign in
On the login page you can sign in with:
- **username + password**,
- **email + password**, or
- **Masuk dengan Google**.

### New here?
- **Join a church:** get the invite code or link from your church admin (for example `graceflow.id/mulai?kode=ABC123`). You join as a Servant, and the admin then assigns your komisi and posisi.
- **Register a new church:** choose **Daftarkan gereja**. You become that church's Superadmin.

---

## 3. For every servant

### Beranda (Home)
- **Tugas berikutnya:** your next duty, with date, time, place and posisi.
- **Butuh pengganti:** duties where someone can't come and a replacement is needed. You can offer to take one.
- **Permintaan tukar jadwal:** swap requests sent to you, which you can accept or decline.
- **Servant care:** gentle reminders when you have been serving a lot. Rest matters too.

### Jadwal (Schedule)
- **Tugas terdekat:** your nearest duty.
- **Bulan ini:** all your duties this month.
- **Kalender:** tap a day to see every service and who is serving.
- **Riwayat pelayanan:** your past duties.

The sections open automatically when you have duties, and you can tap a header to open or close it.

On each duty you can respond:
- **Hadir:** you confirm you will come.
- **Berhalangan:** you can't come. Your coordinator is notified and the slot shows up as *Butuh pengganti*.

### Ketersediaan (Availability)
Tell your coordinator when you can and can't serve:
- **Status umum:** switch yourself OFF for a while (for example travel, exams or rest), with an optional reason and a date to turn back ON automatically.
- **Ketersediaan Jadwal Ibadah:** mark specific upcoming services you can't attend.
- **Ketersediaan Peran:** turn off a posisi you don't want to take for now.

Coordinators and Smart Fill respect these settings.

### Profil (Profile)
- **Ubah profil:** change your name and WhatsApp number. Tap the camera icon to change your photo.
- **Akun & login:**
  - **Username:** add one, or change it (your password is required).
  - **Kata sandi:** change your password (your old password is required).
  - **Email:** connect or change your email. A verification link is sent to the new address, and the old one keeps working until you click it.
  - **Google:** connect a Google account so *Masuk dengan Google* opens this same account, or disconnect it.
- **Statistik pelayanan:** how often you have served and your attendance confirmations.
- **Tampilan (Display):**
  - **Mode tampilan:** light, dark or follow the phone.
  - **Ukuran teks:** Kecil, Normal (default), Besar or Sangat besar.
  - **Bahasa:** Indonesia or English. Notifications also show in your language.
  - **Warna aksen:** the app's accent colour.

  These settings are saved on each device.
- **Keluar:** sign out.

---

## 4. For coordinators

### Atur Jadwal (Build the schedule)
1. Pick the **Komisi** from the dropdown at the top. Next to it, **Grup** manages saved groups of people who often serve together.
2. Choose a service under **Ibadah mendatang**.
3. Tap an empty posisi to pick a person. The list shows who is available and fits that posisi.
   - Tap 🔍 to search everyone in the komisi by name.
4. **Smart Fill** (for this date or the whole month) fills empty slots automatically. It shares duties fairly and skips people who are OFF or already serving at the same time.
5. Share the result:
   - **Ekspor ke WhatsApp:** copy a ready-made schedule message.
   - **Poster foto:** a schedule image to share.
   - **Jadwal latihan:** add rehearsal time and place.

GraceFlow warns you about clashes, such as one person in two places at the same time.

### Peran (Posisi & anggota)
Each of your komisi appears as a card.
- **Tap the card** to edit its posisi (for example Worship Leader, Singer 1, Keyboard). Hold and drag, or use the arrows, to set the order. The slots in Atur Jadwal follow this order.
- **Anggota** opens the member list:
  - search members by name;
  - **Tambah anggota** adds an existing church member to this komisi;
  - remove someone from the komisi. Their upcoming duties are kept.

New accounts are created by the Admin or through the invite code.

---

## 5. For superadmins (Admin page)

| Tab | What you do there |
|---|---|
| **Kalender** | Create and edit services: name, day, time, place, session, notes, prayer/briefing, special labels. Browse month by month. |
| **Pelayan** | Manage servants: create accounts (with a starting password), set role (*Hak akses*), komisi and posisi, and activate or deactivate people. |
| **Komisi** | Create komisi, set name and colour, and sort their order. |
| **Gereja** | Church profile (name, city), church colour, and **Undang anggota**: the invite code or link, which you can regenerate. |

---

## 6. Install the app

- **Android / Chrome / Edge:** open **Profil → Pasang aplikasi**, or use *Install app* in the browser menu.
- **iPhone (Safari):** tap **Share → Add to Home Screen**. Profil shows the steps.

Once installed, GraceFlow opens full screen and the app shell works offline.

---

## 7. FAQ

**I can't see Atur Jadwal or Admin.**
Your role is Servant. Ask your church admin to change it.

**"Masuk dengan Google" created a new, empty account.**
That Google account wasn't connected to your existing login. Sign in with your username or email, then go to **Profil → Akun & login → Google → Hubungkan**.

**I forgot my password.**
There is no self-service reset yet. Ask your church admin for help. If you still remember it, you can change it any time in **Profil → Akun & login → Kata sandi**.

**Sign-in fails on graceflow.id but works on the .web.app address.**
Clear the site data for graceflow.id (or try a private window) and sign in again.

**Can other churches see our data?**
No. Each church's members, services and schedules are visible only to that church.
