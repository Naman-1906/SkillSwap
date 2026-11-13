import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { parseLocation } from './appRoutes';

export default function RouteStateMiddleware({
  setCurrentView,
  setSelectedProfileId,
  setSelectedChatUserId,
  setSearchQuery,
  setInviteToken,
}) {
  const location = useLocation();

  useEffect(() => {
    const routeState = parseLocation(location);
    setCurrentView(routeState.view);
    setSelectedProfileId(routeState.profileId);
    setSelectedChatUserId(routeState.chatUserId);
    setSearchQuery(routeState.searchQuery);
    setInviteToken(routeState.inviteToken || null);
  }, [location, setCurrentView, setSelectedProfileId, setSelectedChatUserId, setSearchQuery, setInviteToken]);

  return null;
}
