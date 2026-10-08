import assert from 'node:assert/strict';
import test from 'node:test';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AdminExportController } from './admin-export.controller';
import { USER_EXPORT_COLUMNS, buildUserExportRow } from './user-export.rows';

test('user export row keeps entered profile, passport, and company fields', () => {
  const row = buildUserExportRow(
    {
      id: 'user-1',
      passwordHash: 'secret-hash',
      firstName: 'Kamol',
      lastName: 'Aliyev',
      fullName: 'Kamol Aliyev',
      role: 'worker',
      phoneNumber: '+998901112233',
      email: 'kamol@example.com',
      district: 'urgut',
      profession: 'Duradgor',
      educationLevel: 'vocational',
      skills: ['Mebel', 'Ta’mirlash'],
      lookingForWork: true,
      companyName: null,
      personalInfo: {
        pinflShouldNotLiveHere: '123',
        additionalPhone: '+998907778899',
        gender: 'male',
      },
      coreIndicators: { familyIncome: 'low', customFlag: 'watch' },
    },
    {
      status: 'pending',
      documentType: 'passport',
      passportData: { series: 'AA', number: '1234567', pinfl: '12345678901234', fullName: 'KAMOL ALIYEV' },
      idPhotoUrl: '/api/uploads/private/user-1/id.jpg',
      selfieUrl: '/api/uploads/private/user-1/selfie.jpg',
    },
  );

  assert.equal(row.profession, 'Duradgor');
  assert.equal(row.educationLevel, 'vocational');
  assert.equal(row.district, 'urgut');
  assert.equal(row.skills, 'Mebel, Ta’mirlash');
  assert.equal(row.lookingForWork, 'Ha');
  assert.equal(row.pi_additionalPhone, '+998907778899');
  assert.equal(row.pi_gender, 'male');
  assert.match(String(row.pi_extra), /pinflShouldNotLiveHere/);
  assert.match(String(row.ci_extra), /customFlag/);
  assert.equal(row.v_series, 'AA');
  assert.equal(row.v_number, '1234567');
  assert.equal(row.v_pinfl, '12345678901234');
  assert.equal(row.v_selfieUrl, '/api/uploads/private/user-1/selfie.jpg');
  assert.equal('passwordHash' in row, false);
  assert.equal(Object.values(row).includes('secret-hash'), false);
  assert.equal(USER_EXPORT_COLUMNS.some((column) => column.key === 'passwordHash'), false);
  assert.equal(
    USER_EXPORT_COLUMNS.every((column) => column.key in row),
    true,
  );
});

test('formula-like profile text is stored as text', () => {
  const row = buildUserExportRow({ id: 'user-2', role: 'employer', bio: '=cmd|"/c calc"!A1', companyName: 'Mehrli' });
  assert.equal(row.bio, `'=cmd|"/c calc"!A1`);
  assert.equal(row.companyName, 'Mehrli');
});

test('excel export is registered without requiring a file extension', () => {
  const paths = Reflect.getMetadata(PATH_METADATA, AdminExportController.prototype.exportUsers) as string | string[];
  const list = Array.isArray(paths) ? paths : [paths];
  assert.ok(list.includes('users'));
  assert.ok(list.includes('users.xlsx'));
});
