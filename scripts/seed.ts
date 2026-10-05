import { PrismaClient, UserRole, MembershipStatus, MessageStatus, RuleCategory, PatternType, RuleSeverity, RuleAction } from "@prisma/client";
import * as argon2 from "argon2";
import crypto from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting idempotent database seed...");

  // 1. Password resolution & hashing with argon2
  let demoPassword = process.env.DEMO_PASSWORD;
  let generatedPassword = false;
  if (!demoPassword || demoPassword.trim() === "") {
    demoPassword = "DemoPassword2026!Secure";
    generatedPassword = true;
  }

  const passwordHash = await argon2.hash(demoPassword);
  if (generatedPassword) {
    console.log("----------------------------------------------------------------");
    console.log(`[DEMO NOTICE] No DEMO_PASSWORD set. Generated demo password: ${demoPassword}`);
    console.log("----------------------------------------------------------------");
  }

  // 2. Upsert Users (1 Admin, 2 Clients, 2 Employees - all @demo.ccp.test)
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@demo.ccp.test" },
    update: { passwordHash, isActive: true },
    create: {
      email: "admin@demo.ccp.test",
      realName: "System Administrator",
      phone: "+15550000001",
      role: UserRole.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  const client1 = await prisma.user.upsert({
    where: { email: "client1@demo.ccp.test" },
    update: { passwordHash, isActive: true },
    create: {
      email: "client1@demo.ccp.test",
      realName: "Fictional Client One",
      phone: "+15550000002",
      role: UserRole.CLIENT,
      passwordHash,
      isActive: true,
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: "client2@demo.ccp.test" },
    update: { passwordHash, isActive: true },
    create: {
      email: "client2@demo.ccp.test",
      realName: "Fictional Client Two",
      phone: "+15550000003",
      role: UserRole.CLIENT,
      passwordHash,
      isActive: true,
    },
  });

  const employee1 = await prisma.user.upsert({
    where: { email: "employee1@demo.ccp.test" },
    update: { passwordHash, isActive: true },
    create: {
      email: "employee1@demo.ccp.test",
      realName: "Fictional Employee One",
      phone: "+15550000004",
      role: UserRole.EMPLOYEE,
      passwordHash,
      isActive: true,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: "employee2@demo.ccp.test" },
    update: { passwordHash, isActive: true },
    create: {
      email: "employee2@demo.ccp.test",
      realName: "Fictional Employee Two",
      phone: "+15550000005",
      role: UserRole.EMPLOYEE,
      passwordHash,
      isActive: true,
    },
  });

  // 3. Upsert Projects (Alpha & Beta)
  let projectAlpha = await prisma.project.findFirst({
    where: { title: "Project Alpha" },
  });
  if (!projectAlpha) {
    projectAlpha = await prisma.project.create({
      data: {
        title: "Project Alpha",
        description: "Confidential R&D Assessment - Alpha Track",
        status: "ACTIVE",
      },
    });
  }

  let projectBeta = await prisma.project.findFirst({
    where: { title: "Project Beta" },
  });
  if (!projectBeta) {
    projectBeta = await prisma.project.create({
      data: {
        title: "Project Beta",
        description: "Confidential Operations Audit - Beta Track",
        status: "ACTIVE",
      },
    });
  }

  // 4. Upsert Conversations (one per project)
  const conversationAlpha = await prisma.conversation.upsert({
    where: { projectId: projectAlpha.id },
    update: {},
    create: {
      projectId: projectAlpha.id,
    },
  });

  const conversationBeta = await prisma.conversation.upsert({
    where: { projectId: projectBeta.id },
    update: {},
    create: {
      projectId: projectBeta.id,
    },
  });

  // 5. Upsert Memberships with Isolated Aliases
  // Alpha: Client 1 ("Client A") + Employee 1 ("Project Specialist B")
  const membershipAlphaClient = await prisma.membership.upsert({
    where: {
      userId_projectId: {
        userId: client1.id,
        projectId: projectAlpha.id,
      },
    },
    update: { alias: "Client A", status: MembershipStatus.ACTIVE },
    create: {
      userId: client1.id,
      projectId: projectAlpha.id,
      alias: "Client A",
      role: "CLIENT",
      status: MembershipStatus.ACTIVE,
    },
  });

  const membershipAlphaEmployee = await prisma.membership.upsert({
    where: {
      userId_projectId: {
        userId: employee1.id,
        projectId: projectAlpha.id,
      },
    },
    update: { alias: "Project Specialist B", status: MembershipStatus.ACTIVE },
    create: {
      userId: employee1.id,
      projectId: projectAlpha.id,
      alias: "Project Specialist B",
      role: "EMPLOYEE",
      status: MembershipStatus.ACTIVE,
    },
  });

  // Beta: Client 2 ("Client C") + Employee 2 ("Project Specialist D")
  const membershipBetaClient = await prisma.membership.upsert({
    where: {
      userId_projectId: {
        userId: client2.id,
        projectId: projectBeta.id,
      },
    },
    update: { alias: "Client C", status: MembershipStatus.ACTIVE },
    create: {
      userId: client2.id,
      projectId: projectBeta.id,
      alias: "Client C",
      role: "CLIENT",
      status: MembershipStatus.ACTIVE,
    },
  });

  const membershipBetaEmployee = await prisma.membership.upsert({
    where: {
      userId_projectId: {
        userId: employee2.id,
        projectId: projectBeta.id,
      },
    },
    update: { alias: "Project Specialist D", status: MembershipStatus.ACTIVE },
    create: {
      userId: employee2.id,
      projectId: projectBeta.id,
      alias: "Project Specialist D",
      role: "EMPLOYEE",
      status: MembershipStatus.ACTIVE,
    },
  });

  // 6. Seed ReadStates
  await prisma.readState.upsert({
    where: {
      membershipId_conversationId: {
        membershipId: membershipAlphaClient.id,
        conversationId: conversationAlpha.id,
      },
    },
    update: {},
    create: {
      membershipId: membershipAlphaClient.id,
      conversationId: conversationAlpha.id,
    },
  });

  await prisma.readState.upsert({
    where: {
      membershipId_conversationId: {
        membershipId: membershipAlphaEmployee.id,
        conversationId: conversationAlpha.id,
      },
    },
    update: {},
    create: {
      membershipId: membershipAlphaEmployee.id,
      conversationId: conversationAlpha.id,
    },
  });

  await prisma.readState.upsert({
    where: {
      membershipId_conversationId: {
        membershipId: membershipBetaClient.id,
        conversationId: conversationBeta.id,
      },
    },
    update: {},
    create: {
      membershipId: membershipBetaClient.id,
      conversationId: conversationBeta.id,
    },
  });

  await prisma.readState.upsert({
    where: {
      membershipId_conversationId: {
        membershipId: membershipBetaEmployee.id,
        conversationId: conversationBeta.id,
      },
    },
    update: {},
    create: {
      membershipId: membershipBetaEmployee.id,
      conversationId: conversationBeta.id,
    },
  });

  // 7. Seed Ordinary Demo Messages
  // Alpha messages
  const msgAlpha1ClientId = "demo-msg-alpha-001";
  await prisma.message.upsert({
    where: {
      senderMembershipId_clientMessageId: {
        senderMembershipId: membershipAlphaClient.id,
        clientMessageId: msgAlpha1ClientId,
      },
    },
    update: {},
    create: {
      conversationId: conversationAlpha.id,
      senderMembershipId: membershipAlphaClient.id,
      clientMessageId: msgAlpha1ClientId,
      body: "Hello. We have reviewed the initial project scope for Alpha.",
      status: MessageStatus.DELIVERED,
      deliveredAt: new Date(Date.now() - 3600000 * 2),
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
  });

  const msgAlpha2EmployeeId = "demo-msg-alpha-002";
  await prisma.message.upsert({
    where: {
      senderMembershipId_clientMessageId: {
        senderMembershipId: membershipAlphaEmployee.id,
        clientMessageId: msgAlpha2EmployeeId,
      },
    },
    update: {},
    create: {
      conversationId: conversationAlpha.id,
      senderMembershipId: membershipAlphaEmployee.id,
      clientMessageId: msgAlpha2EmployeeId,
      body: "Received and acknowledged. The technical specifications look aligned with requirements.",
      status: MessageStatus.DELIVERED,
      deliveredAt: new Date(Date.now() - 3600000),
      createdAt: new Date(Date.now() - 3600000),
    },
  });

  // Beta messages
  const msgBeta1ClientId = "demo-msg-beta-001";
  await prisma.message.upsert({
    where: {
      senderMembershipId_clientMessageId: {
        senderMembershipId: membershipBetaClient.id,
        clientMessageId: msgBeta1ClientId,
      },
    },
    update: {},
    create: {
      conversationId: conversationBeta.id,
      senderMembershipId: membershipBetaClient.id,
      clientMessageId: msgBeta1ClientId,
      body: "Welcome to Project Beta communications channel.",
      status: MessageStatus.DELIVERED,
      deliveredAt: new Date(Date.now() - 1800000),
      createdAt: new Date(Date.now() - 1800000),
    },
  });

  // 8. Seed Baseline Moderation Rules (CONTACT, OFF_PLATFORM, COMMERCIAL, ABUSE)
  const defaultRules = [
    {
      name: "Phone Number Detection",
      category: RuleCategory.CONTACT,
      pattern: "\\b(\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b",
      patternType: PatternType.REGEX,
      severity: RuleSeverity.HIGH,
      action: RuleAction.HOLD,
      isLocked: true,
      isActive: true,
    },
    {
      name: "Email Address Detection",
      category: RuleCategory.CONTACT,
      pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b",
      patternType: PatternType.REGEX,
      severity: RuleSeverity.HIGH,
      action: RuleAction.HOLD,
      isLocked: true,
      isActive: true,
    },
    {
      name: "Off-Platform Solicitation",
      category: RuleCategory.OFF_PLATFORM,
      pattern: "\\b(whatsapp|telegram|call me|pay me directly|outside the portal|wa\\.me|t\\.me)\\b",
      patternType: PatternType.REGEX,
      severity: RuleSeverity.HIGH,
      action: RuleAction.HOLD,
      isLocked: false,
      isActive: true,
    },
    {
      name: "Commercial Negotiation",
      category: RuleCategory.COMMERCIAL,
      pattern: "\\b(price|quote|cost|discount|advance|invoice|refund)\\b",
      patternType: PatternType.REGEX,
      severity: RuleSeverity.MEDIUM,
      action: RuleAction.ALLOW_FLAG,
      isLocked: false,
      isActive: true,
    },
    {
      name: "Abusive Language",
      category: RuleCategory.ABUSE,
      pattern: "\\b(idiot|scam|fraud|threat)\\b",
      patternType: PatternType.REGEX,
      severity: RuleSeverity.HIGH,
      action: RuleAction.ALLOW_FLAG,
      isLocked: false,
      isActive: true,
    },
  ];

  for (const rule of defaultRules) {
    const existing = await prisma.rule.findFirst({
      where: { name: rule.name },
    });
    if (!existing) {
      await prisma.rule.create({ data: rule });
    }
  }

  console.log("Database seeded successfully with fictional demo data!");
}

main()
  .catch((e) => {
    console.error("Seed execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
