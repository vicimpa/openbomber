import { useState } from "react";

import { Box } from "../Box";
import { Button } from "../Button";
import { makeMenu } from "../Menu";
import { Panel } from "../Panel";
import { Sized } from "../Sized";
import { Typo } from "../Typo";
import styles from "./Profile.module.sass";

const ProfileMenu = makeMenu({
  main: m => (
    <div>
      <Typo elem="h4" align="center">Профиль</Typo>
      <Button disabled>Статистика</Button>
      <Button onClick={() => m.menu('changeNick')}>Изменить имя</Button>
      <Button>Изменить скин</Button>
      <Button disabled>Аккаунты</Button>
    </div>
  ),
  changeNick: m => (
    <div>
      <Typo elem="h4" align="center">Изменить имя</Typo>
      <Button>PromiSe####</Button>
      <Button>Значки</Button>
      <Button color="info" onClick={() => m.menu()}>Сохранить</Button>
      <Button color="error" onClick={() => m.menu()}>Назад</Button>
    </div>
  )
}, e => (
  <Sized all>
    <Box width={260} className={styles.menuBox}>
      {e}
    </Box>
  </Sized>
));

export const Profile = () => {
  const [showSkin, setShowSkin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={styles.profile}>
      <Panel className={styles.panel}>
        <Box className={styles.profileBox} onClick={setShowMenu.bind(null, v => !v)}>
          <div className={styles.row}>
            <Typo elem="span">PromiSe####</Typo>
            <Typo elem="small" color="warning">Гость</Typo>
          </div>
          <div className={styles.row} data-stat>
            <Typo elem="span">Ранг:<Typo elem="b">0</Typo></Typo>
            <Typo elem="span">Ранг:<Typo elem="b">0</Typo></Typo>
            <Typo elem="span">Ранг:<Typo elem="b">0</Typo></Typo>
          </div>
        </Box>
        <ProfileMenu show={showMenu} />
      </Panel>
      <Panel className={styles.photo} onClick={setShowSkin.bind(null, v => !v)}>
        <Sized all>
          <Box width={showSkin ? 260 : 50} height={showSkin ? 260 : 50}>

          </Box>
        </Sized>
      </Panel>
    </div >
  );
};