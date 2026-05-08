import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  console.error("[Seed] Production ortamında seed çalıştırılamaz. NODE_ENV=production");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const managerPass = await bcrypt.hash("manager123", 10);
  const empPass = await bcrypt.hash("employee123", 10);

  const manager = await prisma.user.upsert({
    where: { email: "manager@timesheet.local" },
    update: {},
    create: { name: "Ali Yildiz", email: "manager@timesheet.local", passwordHash: managerPass, role: Role.MANAGER },
  });

  const emp = await prisma.user.upsert({
    where: { email: "erto@timesheet.local" },
    update: {},
    create: { name: "Ertugrul Sertcelik", email: "erto@timesheet.local", passwordHash: empPass, role: Role.EMPLOYEE },
  });

  for (const user of [manager, emp]) {
    await prisma.gamification.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  const projects = [
    { name: "tkpay", color: "#D85A30", description: "tkpay odeme platformu" },
    { name: "Hayhay Finansman", color: "#7F77DD", description: "Hayhay kredi urunleri" },
    { name: "Altyapi / DevOps", color: "#1D9E75", description: "Kubernetes, CI/CD, monitoring" },
    { name: "Toplanti / Genel", color: "#BA7517", description: "Toplantilar ve genel gorevler" },
  ];

  for (const p of projects) {
    await prisma.project.create({ data: p }).catch(() => {});
  }

  console.log("Seed tamamlandi");
  console.log("  manager@timesheet.local / manager123");
  console.log("  erto@timesheet.local    / employee123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
