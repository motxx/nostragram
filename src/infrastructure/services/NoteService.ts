import { NDKEvent, NDKFilter, NDKKind } from '@nostr-dev-kit/ndk'
import { Media, Note } from '@/domain/entities/Note'
import {
  NoteRepository,
  SubscribeNotesOptions,
} from '@/domain/repositories/NoteRepository'
import { UserProfileRepository } from '@/domain/repositories/UserProfileRepository'
import { User } from '@/domain/entities/User'
import { NostrClient } from '@/infrastructure/nostr/nostrClient'
import { unixtimeOf } from '../nostr/utils'
import { NoteReactions } from '@/domain/entities/NoteReactions'

const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi']

export class NoteService implements NoteRepository {
  #nostrClient: NostrClient
  #userProfileRepository: UserProfileRepository

  constructor(
    nostrClient: NostrClient,
    userProfileRepository: UserProfileRepository
  ) {
    this.#nostrClient = nostrClient
    this.#userProfileRepository = userProfileRepository
  }

  async postNote(note: Note): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async subscribeNotes(
    onNote: (note: Note) => void,
    options?: SubscribeNotesOptions
  ): Promise<{ unsubscribe: () => void }> {
    const user = await this.#nostrClient.getLoggedInUser()
    const follows = await user.follows()
    const authors =
      options?.authorPubkeys ??
      Array.from(follows.values()).map((a) => a.pubkey)

    const filterOptions: NDKFilter = {
      kinds: [NDKKind.Text],
      authors,
      since: options?.since ? unixtimeOf(options.since) : undefined,
      until: options?.until ? unixtimeOf(options.until) : undefined,
      limit: options?.limit ?? 20,
      // NIP-50: Search Capability - https://scrapbox.io/nostr/NIP-50
      // search文字列の仕様はRelayer依存
      search: options?.image
        ? `http.+(${imageExtensions.join('|')})`
        : undefined,
    }

    return await this.#nostrClient.subscribeEvents(
      filterOptions,
      async (event: NDKEvent) => {
        const note = await this.createNoteFromEvent(event)
        onNote(note)
      },
      options?.isForever
    )
  }

  async subscribeZaps(onZapEvent: (event: NDKEvent) => void): Promise<void> {
    throw new Error('Method not implemented.')
  }

  private getUrlExtension(url: string): string | undefined {
    const pathname = new URL(url).pathname
    const parts = pathname.split('.')
    return parts.length > 1 ? parts.pop()?.toLowerCase() : undefined
  }

  private isImageUrl(url: string): boolean {
    const extension = this.getUrlExtension(url)
    return extension ? imageExtensions.includes(extension) : false
  }

  private isVideoUrl(url: string): boolean {
    const extension = this.getUrlExtension(url)
    return extension ? videoExtensions.includes(extension) : false
  }

  private isYouTubeUrl(url: string): boolean {
    return /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?[\w-]+/.test(
      url
    )
  }

  private async extractMedia(event: NDKEvent): Promise<Media[]> {
    const content = event.content
    const urlPattern = /(https?:\/\/[^\s]+)/g
    const matches = content.match(urlPattern) || []

    const media: Media[] = []

    for (const url of matches) {
      if (await this.isImageUrl(url)) {
        media.push({ type: 'image', url })
      } else if (await this.isVideoUrl(url)) {
        media.push({ type: 'video', url })
      } else if (this.isYouTubeUrl(url)) {
        media.push({ type: 'youtube', url })
      }
    }

    return media
  }

  private async createNoteFromEvent(
    event: NDKEvent,
    depth: number = 0
  ): Promise<Note> {
    const profile = await this.#userProfileRepository.fetchProfile(
      event.author.npub
    )
    const author = new User({
      npub: event.author.npub,
      pubkey: event.author.pubkey,
      profile,
    })
    const media = await this.extractMedia(event)
    const json = JSON.stringify(event.rawEvent())

    const replyEventId = event.tags.find((tag) => tag[0] === 'e')?.[1]
    const replyEvent =
      replyEventId && depth === 0
        ? await this.#nostrClient.fetchEvent(replyEventId)
        : undefined

    return new Note({
      id: event.id,
      author,
      text: event.content,
      media,
      json,
      replyParentNote: replyEvent
        ? await this.createNoteFromEvent(replyEvent, 1)
        : undefined,
      replyChildNotes: [],
      reactions: await this.createNoteReactionsFromEvent(event),
      created_at: event.created_at
        ? new Date(event.created_at * 1000)
        : new Date('1970-01-01T00:00:00Z'),
    })
  }

  private async createNoteReactionsFromEvent(
    event: NDKEvent
  ): Promise<NoteReactions> {
    const likeFilter: NDKFilter = {
      kinds: [NDKKind.Reaction],
      '#e': [event.id],
    }

    let likesCount = 0
    let repostsCount = 0
    let zapsAmount = 0
    const customReactions: { [key: string]: number } = {}

    const reactionEvents = await this.#nostrClient.fetchEvents(likeFilter)

    for (const reactionEvent of reactionEvents) {
      const content = reactionEvent.content.trim()

      if (content === '+' || content === '') {
        likesCount++
      } else if (
        (content.startsWith(':') && content.endsWith(':')) ||
        (content.length === 1 && content.match(/\p{Emoji}/u))
      ) {
        customReactions[content] = (customReactions[content] || 0) + 1
      }
    }

    const repostFilter: NDKFilter = {
      kinds: [NDKKind.Repost],
      '#e': [event.id],
    }
    const repostEvents = await this.#nostrClient.fetchEvents(repostFilter)
    repostsCount = repostEvents.length

    zapsAmount = await this.#nostrClient.calculateZapsAmount(event.id)

    return new NoteReactions({
      likesCount,
      repostsCount,
      zapsAmount,
      customReactions,
    })
  }
}
