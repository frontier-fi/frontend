import { ProjectConfig } from '@repo/lib/config/config.types'
import { PartnerVariant, PoolDisplayType, PoolFilterType } from '@repo/lib/modules/pool/pool.types'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'

const hiddenPoolTypes: PoolFilterType[] = [
  GqlPoolTypeValues.Fx,
  GqlPoolTypeValues.CowAmm,
  GqlPoolTypeValues.QuantAmmWeighted,
  'AUTORANGE',
]

export const ProjectConfigFrontier: ProjectConfig = {
  projectId: 'frontier',
  projectName: 'Frontier Finance',
  legalEntityName: 'Frontier Finance',
  projectUrl: 'https://frontier.fi',
  appUrl: 'https://app.frontier.fi',
  projectLogo: '/images/icons/0xff.png',
  acceptedPoliciesVersion: undefined,
  // Frontier API is Sepolia-only for now (api.frontier.fi).
  supportedNetworks: [GqlChainValues.Sepolia],
  variantConfig: {
    [PartnerVariant.cow]: {
      banners: {
        headerSrc: '/images/partners/cow-header.svg',
        footerSrc: '/images/partners/cow-footer.svg',
      },
    },
  },
  corePoolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014', // veBAL BAL8020 (Balancer 80 BAL 20 WETH) pool on Ethereum
  defaultNetwork: GqlChainValues.Sepolia,
  ensNetwork: GqlChainValues.Sepolia,
  delegateOwner: '0xba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1b',
  // Merkl does not support Sepolia (api.merkl.xyz returns 400); leave empty until a Merkl chain is live.
  merklRewardsChains: [],
  options: {
    poolDisplayType: PoolDisplayType.TokenPills,
    hidePoolTags: ['DYNAMIC_ECLP', 'VE8020'],
    hidePoolTypes: hiddenPoolTypes,
    hideProtocolVersion: ['v2', 'v3', 'cow'],
    hideHooksFilters: true,
    requireHookReview: false,
    showPoolName: false,
    allowCreateWallet: true,
    isOnSafeAppList: true,
  },
  links: {
    appLinks: [],
    ecosystemLinks: [
      { label: 'Pool creator', href: '/create' },
      { label: 'Blog', href: 'https://medium.com/balancer-protocol' },
      { label: 'Docs', href: 'https://docs.balancer.fi/' },
    ],
    socialLinks: [
      {
        iconType: 'x',
        href: 'https://x.com/frontier_fi',
      },
      {
        iconType: 'github',
        href: 'https://github.com/frontier-fi/',
      },
    ],
    legalLinks: [
      { label: '3rd party services', href: '/3rd-party-services' },
      { label: 'Risks', href: '/risks' },
    ],
  },
  footer: {
    linkSections: [
      {
        title: 'Build on Frontier Finance',
        links: [
          { label: 'Home', href: '/' },
          { label: 'Docs', href: 'https://docs.balancer.fi', isExternal: true },
          {
            label: 'Code & Contracts',
            href: 'https://github.com/frontier-fi/',
            isExternal: true,
          },
        ],
      },
      {
        title: 'Use Frontier Finance',
        links: [
          { label: 'Explore pools', href: '/pools' },
          { label: 'Swap tokens', href: '/swap' },
          { label: 'View portfolio', href: '/portfolio' },
        ],
      },
    ],
  },
  cowSupportedNetworks: [],
  partnerCards: [],
  promoItems: [],
}
