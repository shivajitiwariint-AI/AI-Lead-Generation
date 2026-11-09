@echo off
echo ========================================
echo  AI Lead Generation - Database Setup
echo ========================================
echo.

echo [1/4] Checking if MySQL is running...
mysqladmin -u root ping 2>nul
if errorlevel 1 (
    echo ERROR: MySQL is not running!
    echo Please start MySQL from XAMPP Control Panel first.
    echo.
    pause
    exit /b 1
)
echo MySQL is running. ✓

echo.
echo [2/4] Creating database 'ai_lead_gen'...
mysql -u root -e "CREATE DATABASE IF NOT EXISTS ai_lead_gen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
if errorlevel 1 (
    echo ERROR: Failed to create database.
    echo.
    pause
    exit /b 1
)
echo Database created. ✓

echo.
echo [3/4] Running Prisma migrations...
npx prisma migrate dev --name init
if errorlevel 1 (
    echo ERROR: Migration failed.
    echo.
    pause
    exit /b 1
)
echo Migrations complete. ✓

echo.
echo [4/4] Seeding database...
npx prisma db seed
if errorlevel 1 (
    echo ERROR: Seed failed.
    echo.
    pause
    exit /b 1
)
echo Seed complete. ✓

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Demo Login:
echo   Email:    admin@demo.com
echo   Password: Admin123!
echo.
echo Start the app: npm run dev
echo Then open:     http://localhost:3000
echo.
pause
