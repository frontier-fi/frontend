import { aWjAuraWethPoolElementMock } from '@repo/lib/test/msw/builders/gqlPoolElement.builders'
import type { GqlPoolUserBalance } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlPoolStakingTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  calcNonOnChainFetchedStakedBalance,
  calcTotalStakedBalanceInt,
  getUserTotalBalanceInt,
  getUserWalletBalanceInt,
  calcTotalStakedBalance,
  calcTotalStakedBalanceUsd,
  getUserTotalBalance,
  getUserTotalBalanceUsd,
  getUserWalletBalance,
  getUserWalletBalanceUsd,
  hasStakedBalanceFor,
  hasBalancerStakedBalance,
  hasTinyBalance,
  getUserStakedBalances,
} from './user-balance.helpers'

test('User balance helpers — Frontier has no stakedBalances', () => {
  const pool = aWjAuraWethPoolElementMock()

  const userBalanceMock: GqlPoolUserBalance = {
    __typename: 'GqlPoolUserBalance',
    walletBalance: '100',
    walletBalanceUsd: 200,
    totalBalance: '175',
    totalBalanceUsd: 300,
  }

  pool.userBalance = userBalanceMock

  expect(getUserTotalBalance(pool)).toBe('175.000000000000000000')
  expect(getUserTotalBalanceUsd(pool)).toBe(300)
  expect(getUserTotalBalanceInt(pool)).toBe(175000000000000000000n)

  expect(getUserStakedBalances(pool)).toEqual([])
  expect(calcTotalStakedBalance(pool)).toBe('0')
  expect(calcTotalStakedBalanceUsd(pool)).toBe(0)
  expect(calcTotalStakedBalanceInt(pool)).toBe(0n)

  expect(getUserWalletBalance(pool)).toBe('100')
  expect(getUserWalletBalanceUsd(pool)).toBe(200)
  expect(getUserWalletBalanceInt(pool)).toBe(100000000000000000000n)

  expect(calcNonOnChainFetchedStakedBalance(pool)).toBe('0')

  expect(hasBalancerStakedBalance(pool)).toBeFalsy()
  expect(hasStakedBalanceFor(pool, GqlPoolStakingTypeValues.Gauge)).toBeFalsy()
  expect(hasTinyBalance(pool)).toBeFalsy()
})

test('has tiny balance', () => {
  const pool = aWjAuraWethPoolElementMock()

  const userBalanceMock: GqlPoolUserBalance = {
    __typename: 'GqlPoolUserBalance',
    walletBalance: '0.1',
    walletBalanceUsd: 0,
    totalBalance: '0.12345',
    totalBalanceUsd: 0.0009,
  }

  pool.userBalance = userBalanceMock
  expect(hasTinyBalance(pool)).toBeTruthy()
})

describe('invalid balance fallbacks', () => {
  test('getUserTotalBalance returns 0 when totalBalance is invalid', () => {
    const pool = aWjAuraWethPoolElementMock()

    pool.userBalance = {
      __typename: 'GqlPoolUserBalance',
      walletBalance: '100',
      walletBalanceUsd: 200,
      totalBalance: '',
      totalBalanceUsd: 300,
    }

    expect(getUserTotalBalance(pool)).toBe('0')
  })

  test('getUserTotalBalanceInt returns 0n when totalBalance is invalid', () => {
    const pool = aWjAuraWethPoolElementMock()

    pool.userBalance = {
      __typename: 'GqlPoolUserBalance',
      walletBalance: '100',
      walletBalanceUsd: 200,
      totalBalance: null as any,
      totalBalanceUsd: 300,
    }

    expect(getUserTotalBalanceInt(pool)).toBe(0n)
  })

  test('calcStakedBalance ignores API stakedBalances on Frontier', () => {
    const pool = aWjAuraWethPoolElementMock()

    pool.userBalance = {
      __typename: 'GqlPoolUserBalance',
      walletBalance: '100',
      walletBalanceUsd: 200,
      totalBalance: '175',
      totalBalanceUsd: 300,
    }

    expect(calcTotalStakedBalance(pool)).toBe('0')
    expect(calcTotalStakedBalanceUsd(pool)).toBe(0)
  })

  test('handles scientific notation from API balances', () => {
    const pool = aWjAuraWethPoolElementMock()

    pool.userBalance = {
      __typename: 'GqlPoolUserBalance',
      walletBalance: '6.1713167421e-8',
      walletBalanceUsd: 0,
      totalBalance: '6.1713167421e-8',
      totalBalanceUsd: 0,
    }

    expect(getUserWalletBalanceInt(pool)).toBe(61713167421n)
    expect(getUserTotalBalanceInt(pool)).toBe(61713167421n)
    expect(calcTotalStakedBalanceInt(pool)).toBe(0n)
  })
})
