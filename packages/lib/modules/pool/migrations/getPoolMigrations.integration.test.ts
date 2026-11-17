import { getPoolMigrations } from './getPoolMigrations'

describe('Fetching pool migration metadata', () => {
  it('should return a valid migrations array', async () => {
    const migrations = await getPoolMigrations()

    expect(Array.isArray(migrations)).toBe(true)

    if (migrations.length > 0) {
      expect(migrations[0]!.new).not.toBeUndefined()
      expect(migrations[0]!.old).not.toBeUndefined()
    }
  })
})
