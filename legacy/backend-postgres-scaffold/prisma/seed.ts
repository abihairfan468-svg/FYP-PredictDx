import { PrismaClient, Role, Gender } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const password = await argon2.hash('Predictdx@123');

  // ---- Admin ----
  await prisma.user.upsert({
    where: { email: 'admin@predictdx.pk' },
    update: {},
    create: {
      email: 'admin@predictdx.pk',
      fullName: 'System Administrator',
      role: Role.ADMIN,
      passwordHash: password,
      emailVerified: true,
    },
  });

  // ---- Doctor ----
  const doctorUser = await prisma.user.upsert({
    where: { email: 'dr.zeeshan@predictdx.pk' },
    update: {},
    create: {
      email: 'dr.zeeshan@predictdx.pk',
      fullName: 'Dr. Zeeshan',
      role: Role.DOCTOR,
      passwordHash: password,
      emailVerified: true,
    },
  });

  await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      specialization: 'Pulmonology',
      pmdcNumber: 'PMDC-00001',
      qualification: 'MBBS, FCPS (Pulmonology)',
      experienceYears: 8,
      consultationFee: 2000,
      hospital: 'Family Medical Hospital',
      isVerified: true,
    },
  });

  // ---- Patient ----
  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@predictdx.pk' },
    update: {},
    create: {
      email: 'patient@predictdx.pk',
      fullName: 'Demo Patient',
      role: Role.PATIENT,
      passwordHash: password,
      emailVerified: true,
    },
  });

  await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      mrn: 'MRN-000001',
      dateOfBirth: new Date('1998-04-12'),
      gender: Gender.FEMALE,
      bloodGroup: 'B+',
      city: 'Islamabad',
    },
  });

  // ---- Active model version ----
  await prisma.modelVersion.upsert({
    where: { name_version: { name: 'densenet121-3class', version: 'v0.1.0-stub' } },
    update: { isActive: true },
    create: {
      name: 'densenet121-3class',
      version: 'v0.1.0-stub',
      architecture: 'DenseNet121 (transfer learning, 3-class)',
      fileKey: 'models/predictdx_densenet121_v1.keras',
      trainedAt: new Date(),
      isActive: true,
      notes: 'Placeholder record. Replace with real metrics after the first training run.',
    },
  });

  console.log('Seed complete. Login with any of:');
  console.log('  admin@predictdx.pk / Predictdx@123');
  console.log('  dr.zeeshan@predictdx.pk / Predictdx@123');
  console.log('  patient@predictdx.pk / Predictdx@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
