# Local Development Setup — MySQL + phpMyAdmin

## Prerequisites
- Docker Desktop (recommended) OR XAMPP / WAMP / local MySQL install

## Option A: Docker (Recommended)

### 1. Start MySQL + phpMyAdmin
```bash
docker-compose up -d
```

This starts:
- **MySQL** on `localhost:3306` (root/root, database `ai_lead_gen`)
- **phpMyAdmin** on `http://localhost:8080` (login: root / root)

### 2. Configure Environment
Copy the example env file and fill in values:
```bash
copy .env.example .env
```
Edit `.env` — the `DATABASE_URL` is already set for local Docker MySQL.

### 3. Initialize Database
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

This creates all tables and seeds:
- Plans: Starter, Growth, Enterprise
- Roles: Super Admin, Company Owner, Sales Manager, Sales Rep, Analyst
- Industries: 10 categories
- AI Providers: Anthropic, Gemini, Grok, Ollama, OpenAI
- Starter tenant + admin user

**Starter login:** `admin@example.com` / `Admin123!`

### 4. Run the App
```bash
npm run dev
```
Open `http://localhost:3000`

## Option B: Local MySQL (XAMPP / WAMP / Manual Install)

### 1. Install MySQL
- **XAMPP** (Windows): https://www.apachefriends.org — includes MySQL + phpMyAdmin
- **WAMP** (Windows): http://www.wampserver.com
- **MySQL Installer**: https://dev.mysql.com/downloads/installer/

### 2. Create Database
In phpMyAdmin (usually `http://localhost/phpmyadmin`):
- Create database: `ai_lead_gen`
- Create user: `ai_lead_gen` / `ai_lead_gen` (or use root with no password)

### 3. Configure Environment
```bash
copy .env.example .env
```
Update `DATABASE_URL` to match your local MySQL:
```
DATABASE_URL="mysql://ai_lead_gen:ai_lead_gen@localhost:3306/ai_lead_gen"
```

### 4. Initialize Database
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Run the App
```bash
npm run dev
```

## phpMyAdmin Access

| Method | URL | Login |
|--------|-----|-------|
| Docker | http://localhost:8080 | Server: `mysql`, User: `root`, Password: `root` |
| XAMPP | http://localhost/phpmyadmin | User: `root`, Password: (empty) |

## Useful Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name init

# Reset database (deletes all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio

# Seed database
npx prisma db seed
```

## Troubleshooting

**MySQL connection refused:**
- Ensure MySQL container is running: `docker ps`
- Check port 3306 is free: `netstat -ano | findstr 3306`

**Authentication plugin error:**
- MySQL 8 uses `caching_sha2_password` by default. The docker-compose uses `mysql_native_password` for compatibility.

**Prisma client not generated:**
- Run `npx prisma generate` after changing schema.
