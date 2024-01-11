<script lang="ts">
  import achivmentSrc from "images/Bonus/Ikonki.png";
  import { createEventDispatcher } from "svelte";
  import Button from "./Button.svelte";
  import {
    ACHIVMEN_DESCRIPTION,
    ACHIVMEN_POINTS,
    EAchivment,
  } from "@shared/types";
  import Frame from "./Frame.svelte";
  import { MAX_PLAYERS } from "@shared/config";
  import { EXTERNAL_LINKS } from "config";
  import Link from "./Link.svelte";

  const boosts = [...Object.entries(ACHIVMEN_DESCRIPTION)].map(
    ([key, value]) => ({
      key: +key as EAchivment,
      value,
      frame: ACHIVMEN_POINTS[+key as EAchivment],
    })
  );

  const dispatch = createEventDispatcher<{ submit: void }>();
</script>

<div class="scroll">
  <h2>Привет =)</h2>
  <div>
    <h3>На мобильном</h3>
    <ul>
      <li><strong>ВЫРУБАЙ ЭКОНОМИЮ ЗАРЯДА!!!</strong></li>
    </ul>
    <h3>Перед началом</h3>
    <ul>
      <li>Приглашай друзей и веселись 😁</li>
      <li>Слева сайдбар настроек 🕹️</li>
      <li>Справа чатик 💬</li>
      <li>Максимум игроков: <b>{MAX_PLAYERS}</b></li>
      <li>Вверху статус бар панель</li>
      <li>Внизу управление подключением</li>
    </ul>
    <h3>Управление</h3>
    <p>На клавиатуре:</p>
    <ul>
      <li>ходить <b>WASD</b> или <b>Стрелочки</b></li>
      <li>бомба <b>Пробел</b> или <b>Enter</b></li>
    </ul>
    <p>На геймпаде:</p>
    <ul>
      <li>ходить <b>axis(0-1)</b></li>
      <li>бомба <b>btn(0)</b></li>
    </ul>
    <p>На тачскрине:</p>
    <ul>
      <li>ходить <b>появиться джойстик</b></li>
      <li>бомба <b>кнопочка справа</b></li>
    </ul>
    <h3>Цель игры</h3>
    <ul>
      <li>Убить противников</li>
      <li>Не умереть</li>
    </ul>
    <h3>Основная тактика</h3>
    <ul>
      <li>Начинай взрывать кирпичи</li>
      <li>Собирай бусты</li>
      <li>Лови игроков в ловушки</li>
    </ul>
    <h3>Бусты</h3>
    <ul>
      {#each boosts as { key, frame, value }}
        <li>
          <Frame src={achivmentSrc} {frame} s={0.8} padding={16} />
          <small>{value}</small>
        </li>
      {/each}
    </ul>

    <h3>Ссылки</h3>
    <ul>
      {#each EXTERNAL_LINKS as { href, name }}
        <li>
          <Link url={href}>{name}</Link>
        </li>
      {/each}
    </ul>
  </div>
  <Button on:click={() => dispatch("submit")}>Продолжить</Button>
</div>

<style lang="scss">
  .scroll {
    display: flex;
    flex-direction: column;
    overflow-y: scroll;
    gap: 10px;
    max-height: calc(100vh - 50px);
    position: relative;
  }
  h2,
  h3,
  p {
    margin: 0;
    padding: 0;
  }
  h3 {
    font-size: 16px;
    margin-top: 10px;
    margin-bottom: 8px;
  }
  ul {
    margin-bottom: 20px;
  }
  p {
    font-size: 14px;
    font-weight: normal;
    color: #999;
  }
  strong {
    color: red;
  }
  li {
    margin: 5px 0px;
    font-size: 12px;
    color: #999;
    display: flex;
    gap: 10px;
    align-items: center;
    height: 20px;
    &::before {
      content: "#";
      color: #333;
    }
  }
  b {
    color: #fff;
  }
</style>
