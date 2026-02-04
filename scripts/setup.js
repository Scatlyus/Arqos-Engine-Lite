const fs = require('fs');
const path = require('path');

/**
 * Arqos Maestro Setup Script
 * Sets up environment, folders, and provisioning
 */
function setup() {
    console.log("🚀 Starting Arqos Maestro Setup...");

    const rootDir = path.join(__dirname, '..');
    const storageDir = path.join(rootDir, '.storage');
    const envFile = path.join(rootDir, '.env');
    const envExample = path.join(rootDir, '.env.example');

    // 1. Create storage directory
    if (!fs.existsSync(storageDir)) {
        console.log("  Creating .storage directory...");
        fs.mkdirSync(storageDir);
    }

    // 2. Setup .env file
    if (!fs.existsSync(envFile)) {
        console.log("  Generating .env from .env.example...");
        if (fs.existsSync(envExample)) {
            let content = fs.readFileSync(envExample, 'utf8');
            // Default to fullstack for Maestro Edition
            content = content.replace('ARQOS_MODE=lite', 'ARQOS_MODE=fullstack');
            fs.writeFileSync(envFile, content);
        } else {
            console.log("  ⚠️  .env.example not found. Creating minimal .env...");
            fs.writeFileSync(envFile, "ARQOS_MODE=fullstack\nARQOS_PERSISTENCE=local\nARQOS_STORAGE_PATH=./.storage\nPORT_API=5050");
        }
    }

    // 3. Verify packages
    console.log("  Checking monorepo packages...");
    const packages = ['engine', 'maestro-gateway', 'maestro-ui'];
    packages.forEach(pkg => {
        const pkgPath = path.join(rootDir, 'packages', pkg);
        if (fs.existsSync(pkgPath)) {
            console.log(`  ✅ Package ${pkg} found.`);
        } else {
            console.log(`  ❌ Package ${pkg} MISSING!`);
        }
    });

    console.log("\n✅ Setup complete! run 'npm install' then 'npm start' to begin.");
}

setup();
