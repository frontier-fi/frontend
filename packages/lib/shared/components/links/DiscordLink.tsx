import { BalAlertLink } from '@repo/lib/shared/components/alerts/BalAlertLink'

/** Support link used in error messages (Discord removed). */
export function DiscordLink() {
  return (
    <BalAlertLink href="https://github.com/frontier-fi/" isExternal>
      GitHub
    </BalAlertLink>
  )
}
