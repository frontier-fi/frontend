import { Alert, Link } from '@chakra-ui/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

export function ApiOutageAlert() {
  const statusUrl = PROJECT_CONFIG.projectUrl.replace('https://', 'https://status.')

  return (
    <Alert color="font.dark" fontWeight="bold" rounded="none" status="warning">
      We are currently experiencing some technical difficulties, please see&nbsp;
      <Link color="font.dark" href={statusUrl} isExternal textDecoration="underline">
        {statusUrl}
      </Link>
      .
    </Alert>
  )
}
