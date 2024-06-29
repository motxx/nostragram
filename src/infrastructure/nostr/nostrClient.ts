import axios from 'axios'
import NDK, {
  NDKUser,
  NDKNip07Signer,
  NDKKind,
  NDKEvent,
  NDKRelaySet,
  NDKFilter,
  NostrEvent,
} from '@nostr-dev-kit/ndk'
import { SendZapRequestResponse } from '@/infrastructure/services/UserService'
import {
  NostrCallZapEndpointError,
  NostrGetZapEndpointCallbackUrlError,
  NostrInvoiceNotFoundError,
  NostrMaxSendableConstraintError,
  NostrMinSendableConstraintError,
  NostrRequestLnurlPayError,
  NostrUnknownUserError,
} from '@/infrastructure/nostr/nostrErrors'
import { CommonRelays } from '@/infrastructure/nostr/commonRelays'
import {
  LnurlPay,
  toBech32EncodedLnurl,
  toLnurlPayUrl,
} from '@/infrastructure/nostr/lnurlPay'
import { generateEventId, unixtime } from '@/infrastructure/nostr/utils'

const FetchTimeout = 1000 // 1 second
const MaxRetries = 3
const RetryDelay = 100 // 0.1 seconds

export class NostrClient {
  #ndk: NDK
  #user: NDKUser

  private constructor(ndk: NDK, user: NDKUser) {
    this.#ndk = ndk
    this.#user = user
  }

  static readonly LoginTimeoutMSec = 60000
  static readonly Relays = [
    // TODO: クライアントの安定性が確認でき次第リレーを徐々に増やし、ユーザ側でも指定可能にする
    'wss://relay.hakua.xyz',
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    // ...CommonRelays.NIP50SearchCapabilityCompatibles,
    //...CommonRelays.JapaneseRelays,
    //...CommonRelays.Iris,
  ]
  static #nostrClient?: NostrClient

  /**
   * Connect NostrClient by NIP-07 (window.nostr)
   * @returns singleton Promise<NostrClient>
   */
  static async connect(): Promise<NostrClient> {
    if (NostrClient.#nostrClient) {
      return NostrClient.#nostrClient
    }

    const signer = new NDKNip07Signer(NostrClient.LoginTimeoutMSec)
    await signer.blockUntilReady()

    const ndk = new NDK({
      explicitRelayUrls: NostrClient.Relays,
      signer,
    })
    ndk.assertSigner()
    await ndk.connect(1)
    const user = await ndk!.signer!.user()
    await user.fetchProfile()
    NostrClient.#nostrClient = new NostrClient(ndk, user)
    return NostrClient.#nostrClient
  }

  /**
   * Subscribe events specified by filters
   * @param onEvent listener of NDKEvent
   * @param filters NDKFilter
   * @param isForever true: subscribe forever, false: subscribe once
   */
  async subscribeEvents(
    filters: NDKFilter,
    onEvent: (event: NDKEvent) => void,
    isForever: boolean = true
  ) {
    try {
      const relaySet = NDKRelaySet.fromRelayUrls(NostrClient.Relays, this.#ndk)
      const subscription = this.#ndk
        .subscribe(
          filters,
          {
            closeOnEose: !isForever, // subscribe forever
          },
          relaySet,
          true
        )
        .on('event', (event: NDKEvent) => {
          onEvent(event)
        })

      return {
        unsubscribe: () => {
          console.log('unsubscribe', subscription)
          subscription.stop()
        },
      }
    } catch (e) {
      console.error('Error: subscribeEvents: ', e)
      throw e
    }
  }

  /**
   * Fetch event by eventId
   * @param eventId
   * @returns NDKEvent
   */
  async fetchEvent(eventId: string) {
    const event = await this.#ndk.fetchEvent(eventId).catch((e) => {
      console.error('Error: fetchEvent:', e)
      throw e
    })
    return event
  }

  /**
   * Get user from npub
   * @returns NDKUser
   */
  async getUser(npub: string) {
    if (npub.length !== 63 || !npub.startsWith('npub')) {
      throw new Error(`Invalid npub: ${npub}`)
    }
    try {
      return this.#ndk.getUser({ npub })
    } catch (e) {
      console.error('Error: getUser:', e)
      throw e
    }
  }

  /**
   * Get user from nip05Id
   * @param nip05Id
   * @returns NDKUser
   */
  async getUserFromNip05(nip05Id: string) {
    const user = await this.#ndk.getUserFromNip05(nip05Id).catch((e) => {
      console.error('Error: getUserFromNip05:', e)
      throw e
    })
    return user
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async #fetchWithRetry(
    operation: () => Promise<any>,
    retries = 0
  ): Promise<any> {
    try {
      const fetchWithTimeout = async () => {
        return Promise.race([
          operation(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Operation timeout')),
              FetchTimeout
            )
          ),
        ])
      }

      return await fetchWithTimeout()
    } catch (error) {
      console.error(`Error in operation (attempt ${retries + 1}):`, error)
      if (retries < MaxRetries - 1) {
        console.log(`Retrying in ${RetryDelay / 1000} seconds...`)
        await this.delay(RetryDelay)
        return this.#fetchWithRetry(operation, retries + 1)
      } else {
        throw error
      }
    }
  }

  /**
   * Get user from npub and fetch their profile
   * @returns NDKUser with fetched profile
   */
  async getUserWithProfile(npub: string): Promise<NDKUser> {
    if (npub.length !== 63 || !npub.startsWith('npub')) {
      throw new Error(`Invalid npub: ${npub}`)
    }
    try {
      const user = this.#ndk.getUser({ npub })
      await this.#fetchWithRetry(() => user.fetchProfile()).catch((e) => {
        console.error('Error: getUserWithProfile: fetchProfile:', e)
        throw e
      })
      return user
    } catch (e) {
      console.error('Error: getUserWithProfile:', e)
      throw e
    }
  }

  /**
   * Get logged-in user
   * @returns NDKUser
   */
  async getLoggedInUser() {
    return this.#user
  }

  async decryptEvent(event: NDKEvent) {
    await event.decrypt()
    return event
  }

  /**
   * Query zap invoice from NIP-05 identifier
   * NIP-57 Lightning Zaps: https://scrapbox.io/nostr/NIP-57
   * @param nip05Id
   * @param sat
   * @returns SendZapRequestResponse
   */
  async sendZapRequest(
    nip05Id: string,
    sat: number
  ): Promise<SendZapRequestResponse> {
    const millisats = sat * 1000
    const unsignedEvent = await this.#makeZapRequest(nip05Id, millisats)
    const sig = await this.#ndk.signer!.sign(unsignedEvent)

    const zapEndpoint = await this.#getZapEndpointWithParams(
      unsignedEvent,
      sig,
      nip05Id
    )

    // Do not publish. Send the request to zap endpoint.
    const response = await axios.get(zapEndpoint)
    if (!response.data || response.data.status !== 'OK') {
      throw new NostrCallZapEndpointError(response)
    }

    const { pr, verify, successAction } = response.data
    if (!pr) {
      throw new NostrInvoiceNotFoundError(response)
    }

    return {
      pr,
      verify,
      successAction,
    }
  }

  async #requestLnurlPay(metadata: NostrEvent): Promise<LnurlPay> {
    const { lud16 } = JSON.parse(metadata.content)
    const lnurlPayUrl = toLnurlPayUrl(lud16)
    const res = await axios.get(lnurlPayUrl)
    const body: LnurlPay = await res.data
    if (!body.allowsNostr || !body.nostrPubkey) {
      throw new Error(`${lud16} doesn't support Nostr. body: ${body}`)
    }
    return body
  }

  async #getZapEndpointWithParams(
    unsignedEvent: NostrEvent,
    sig: string,
    lud16: string
  ) {
    const metadata: NostrEvent = {
      ...unsignedEvent,
      id: unsignedEvent.tags[4][1],
      kind: 0,
      sig,
      content: JSON.stringify({ lud16 }),
    }
    const lnurlPay = await this.#requestLnurlPay(metadata).catch((e) => {
      throw new NostrRequestLnurlPayError(metadata, e)
    })
    const callbackUrl = lnurlPay.callback
    if (!callbackUrl) {
      throw new NostrGetZapEndpointCallbackUrlError(metadata, lnurlPay)
    }
    const nostr = encodeURI(JSON.stringify(unsignedEvent))
    const amount = +unsignedEvent.tags[1][1]
    if (lnurlPay.minSendable && amount < lnurlPay.minSendable) {
      throw new NostrMinSendableConstraintError(amount, lnurlPay.minSendable)
    }
    if (lnurlPay.maxSendable && amount > lnurlPay.maxSendable) {
      throw new NostrMaxSendableConstraintError(amount, lnurlPay.maxSendable)
    }
    const lnurl = unsignedEvent.tags[2][1]
    const zapEndpoint = new URL(callbackUrl)
    zapEndpoint.searchParams.append('amount', amount.toString())
    zapEndpoint.searchParams.append('nostr', nostr)
    zapEndpoint.searchParams.append('lnurl', lnurl)
    return zapEndpoint.toString()
  }

  async #makeZapRequest(nip05Id: string, msat: number): Promise<NostrEvent> {
    const to = await NDKUser.fromNip05(nip05Id, this.#ndk)
    if (!to) {
      throw new NostrUnknownUserError(nip05Id)
    }

    const unsignedEvent: NostrEvent = {
      kind: NDKKind.ZapRequest,
      pubkey: this.#user.pubkey,
      created_at: unixtime(),
      tags: [
        ['relays', ...NostrClient.Relays],
        ['amount', msat.toString()],
        ['lnurl', toBech32EncodedLnurl(toLnurlPayUrl(nip05Id)!)],
        ['p', to.pubkey],
      ],
      content: 'zap request',
    }
    const eventId = generateEventId(unsignedEvent)
    unsignedEvent.tags.push(['e', eventId])
    return unsignedEvent
  }
}
