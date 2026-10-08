import { UserHydraterService } from './user-hydrater.service';

describe(UserHydraterService.name, () => {
  it('returns an object holding the email by default', async () => {
    await expect(
      new UserHydraterService().hydrateUserByEmail('a@example.com'),
    ).resolves.toEqual({ email: 'a@example.com' });
  });
});
