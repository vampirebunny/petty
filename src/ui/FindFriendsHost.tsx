import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { closeFindFriends, closeFriendScanner, findFriendsSnapshot, onFindFriends, openFindFriends, openFriendScanner } from '../friends/findOpen';
import { friendPromptShouldShow } from '../friends/prompt';
import { FindFriends } from './FindFriends';
import { FriendNotifyPrompt } from './FriendNotifyPrompt';
import { FriendScanner } from './FriendScanner';

type Props = {
  accountHandle: string | null;
  onChanged: () => void;
  children: ReactNode;
};

export function FindFriendsHost({ accountHandle, onChanged, children }: Props) {
  const [snap, setSnap] = useState(findFriendsSnapshot);
  const [prompt, setPrompt] = useState(false);

  useEffect(() => onFindFriends(() => setSnap(findFriendsSnapshot())), []);

  return (
    <View style={styles.fill}>
      {children}
      {snap.open ? (
        <View style={styles.cover}>
          {snap.scanning ? (
            <FriendScanner
              onClose={closeFriendScanner}
              onType={() => {
                closeFriendScanner();
                if (snap.scanFrom === 'code') {
                  openFindFriends();
                }
              }}
              onHandle={(handle) => openFindFriends(handle)}
            />
          ) : (
            <FindFriends
              key={snap.prefill ?? 'search'}
              accountHandle={accountHandle}
              initialHandle={snap.prefill}
              onClose={closeFindFriends}
              onScan={() => openFriendScanner('find')}
              onChanged={onChanged}
              onSent={() => {
                void friendPromptShouldShow('send').then((show) => {
                  if (show) {
                    setPrompt(true);
                  }
                });
              }}
              onAccepted={() => {
                void friendPromptShouldShow('accept').then((show) => {
                  if (show) {
                    setPrompt(true);
                  }
                });
              }}
            />
          )}
        </View>
      ) : null}
      {prompt ? <FriendNotifyPrompt onClose={() => setPrompt(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
});
