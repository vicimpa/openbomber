import { App } from "components/react/App";
import { Box } from "components/react/Box";
import { Button } from "components/react/Button";
import { makeMenu } from "components/react/Menu";
import { Panel } from "components/react/Panel";
import { Profile } from "components/react/Profile";
import { Sized } from "components/react/Sized";
import { Typo } from "components/react/Typo";
import { useCalc } from "hooks/useCalc";

const SettingsMenu = makeMenu({
  main: m => (
    <Box width={250}>
      <Typo elem="h4" align="center">Настройки</Typo>
      <Button disabled>
        Тачскрин
      </Button>
      <Button onClick={() => m.menu('keyboard')}>
        Клавиатура
      </Button>
      <Button disabled>
        Геймпад
      </Button>
      <Button onClick={() => m.menu('sound')}>
        Звук
      </Button>
      <Button disabled>
        Графика
      </Button>
      <Button color="error" onClick={() => m.back()}>
        Назад
      </Button>
    </Box>
  ),
  keyboard: m => (
    <Box width={400}>
      <Typo elem="h4" align="center">Настройки клавиатуры</Typo>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <Button color="error" onClick={() => m.menu()}>
        Назад
      </Button>
    </Box>
  ),
  sound: m => (
    <Box width={400}>
      <Typo elem="h4" align="center">Настройки Звука</Typo>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <h4>Много много настроек</h4>
      <Button color="error" onClick={() => m.menu()}>
        Назад
      </Button>
    </Box>
  )
}, e => <Sized all>{e}</Sized>);

const Menu = makeMenu({
  main: m => (
    <Box width={250}>
      <Typo elem="h4" align="center">Главное меню</Typo>

      <Button disabled>
        Одиночная игра
      </Button>
      <Button>
        Сетевая игра
      </Button>
      <Button disabled>
        Информация
      </Button>
      <Button onClick={() => m.menu('settings')}>
        Настройки
      </Button>
    </Box>
  ),
  settings: () => (
    <SettingsMenu />
  )
}, e => <Sized all>{e}</Sized>);

export const AppReact = () => {

  return (
    <App>
      <Profile />
      <Panel key="menu" padding="20px 30px">
        <Menu />
      </Panel>
    </App>
  );
};