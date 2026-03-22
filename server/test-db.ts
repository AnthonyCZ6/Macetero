import "dotenv/config";
import { prisma } from "./prisma.service";

async function main() {
  const user = await prisma.user.upsert({
    where: { phone: "+521234567890" },
    update: {},
    create: {
      phone: "+521234567890",
      pin_hash: "placeholder_hash",
    },
  });
  console.log("Upserted user:", user);

  const users = await prisma.user.findMany();
  console.log("All users:", users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
