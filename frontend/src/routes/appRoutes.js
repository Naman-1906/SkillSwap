export const ROUTE_PATHS = {
  home: '/',
  auth: '/auth',
  profile: '/profile',
  explore: '/explore',
  search: '/search',
  friends: '/friends',
  bookmarks: '/bookmarks',
  messages: '/messages',
  invite: '/invite',
};

export function buildPath(view, options = {}) {
  switch (view) {
    case 'auth':
      return ROUTE_PATHS.auth;
    case 'profile':
      return options.profileId ? `/profile/${options.profileId}` : ROUTE_PATHS.profile;
    case 'search': {
      const query = options.searchQuery?.trim();
      return query ? `/search?q=${encodeURIComponent(query)}` : ROUTE_PATHS.search;
    }
    case 'messages':
      return options.chatUserId ? `/messages/${options.chatUserId}` : ROUTE_PATHS.messages;
    case 'invite':
      return options.inviteToken ? `${ROUTE_PATHS.invite}/${encodeURIComponent(options.inviteToken)}` : ROUTE_PATHS.home;
    case 'friends':
      return ROUTE_PATHS.friends;
    case 'bookmarks':
      return ROUTE_PATHS.bookmarks;
    case 'explore':
      return ROUTE_PATHS.explore;
    case 'home':
    default:
      return ROUTE_PATHS.home;
  }
}

export function parseLocation(location) {
  const pathname = location.pathname || '/';
  const searchParams = new URLSearchParams(location.search || '');
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === ROUTE_PATHS.home) {
    return { view: 'home', searchQuery: '', profileId: null, chatUserId: null };
  }

  if (pathname === ROUTE_PATHS.auth) {
    return { view: 'auth', searchQuery: '', profileId: null, chatUserId: null };
  }

  if (segments[0] === 'profile') {
    return {
      view: 'profile',
      searchQuery: '',
      profileId: segments[1] || null,
      chatUserId: null,
    };
  }

  if (segments[0] === 'search') {
    return {
      view: 'search',
      searchQuery: searchParams.get('q') || '',
      profileId: null,
      chatUserId: null,
    };
  }

  if (segments[0] === 'messages') {
    return {
      view: 'messages',
      searchQuery: '',
      profileId: null,
      chatUserId: segments[1] || null,
    };
  }

  if (segments[0] === 'invite' && segments[1]) {
    return {
      view: 'invite',
      searchQuery: '',
      profileId: null,
      chatUserId: null,
      inviteToken: segments[1],
    };
  }

  if (segments[0] === 'friends') {
    return { view: 'friends', searchQuery: '', profileId: null, chatUserId: null, inviteToken: null };
  }

  if (segments[0] === 'bookmarks') {
    return { view: 'bookmarks', searchQuery: '', profileId: null, chatUserId: null };
  }

  if (segments[0] === 'explore') {
    return { view: 'explore', searchQuery: '', profileId: null, chatUserId: null };
  }

  return { view: 'home', searchQuery: '', profileId: null, chatUserId: null };
}
