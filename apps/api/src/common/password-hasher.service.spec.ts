import { PasswordHasher } from './password-hasher.service';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('verifies a password against its own hash', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(
      hasher.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.verify(hash, 'wrong password')).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const [a, b] = await Promise.all([
      hasher.hash('same password'),
      hasher.hash('same password'),
    ]);
    expect(a).not.toBe(b);
  });
});
