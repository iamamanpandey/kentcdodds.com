import type {ActionArgs, LoaderArgs} from '@remix-run/node'
import {redirect} from '@remix-run/node'
import type {KCDHandle} from '~/types'
import * as React from 'react'
import {requireUser} from '~/utils/session.server'
import {
  getDomainUrl,
  getErrorMessage,
  getRequiredServerEnvVar,
} from '~/utils/misc'
import {connectDiscord} from '~/utils/discord.server'
import {deleteDiscordCache} from '~/utils/user-info.server'
import {tagKCDSiteSubscriber} from '~/convertkit/convertkit.server'

export const handle: KCDHandle = {
  getSitemapEntries: () => null,
}

export async function loader({request}: LoaderArgs) {
  const FLY_REGION = getRequiredServerEnvVar('FLY_REGION')
  if (FLY_REGION === ENV.PRIMARY_REGION) {
    return handleDiscordCallback(request)
  }

  // we're in a secondary region, so we need to proxy the request to the primary
  // region for the writes
  const req = request.clone()
  if (ENV.PRIMARY_REGION) {
    req.headers.set('fly-prefer-region', ENV.PRIMARY_REGION)
  }
  const response = await fetch(req, {method: 'post'})
  return response
}

export async function action({request}: ActionArgs) {
  return handleDiscordCallback(request)
}

async function handleDiscordCallback(request: Request) {
  const user = await requireUser(request)
  const domainUrl = getDomainUrl(request)
  const code = new URL(request.url).searchParams.get('code')

  const url = new URL(domainUrl)
  url.pathname = '/me'

  try {
    if (!code) {
      throw new Error('Discord code required')
    }
    const discordMember = await connectDiscord({user, code, domainUrl})
    void tagKCDSiteSubscriber({
      email: user.email,
      firstName: user.firstName,
      fields: {
        kcd_site_id: user.id,
        kcd_team: user.team,
        discord_user_id: discordMember.user.id,
      },
    })
    await deleteDiscordCache(discordMember.user.id)

    url.searchParams.set(
      'message',
      `✅ Sucessfully connected your KCD account with ${discordMember.user.username} on discord.`,
    )
    return redirect(url.toString())
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    if (error instanceof Error) {
      console.error(error.stack)
    } else {
      console.error(errorMessage)
    }

    url.searchParams.set('message', `🚨 ${errorMessage}`)
    return redirect(url.toString())
  }
}

export default function DiscordCallback() {
  return (
    <div>
      {`Congrats! You're seeing something you shouldn't ever be able to see because you should have been redirected. Good job!`}
    </div>
  )
}
