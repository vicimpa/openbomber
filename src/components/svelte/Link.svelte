<script lang="ts">
  export let url = "";
  export let icon: string | undefined = undefined;
  const regExp = /^https?:\/\/([^\/]+)/;

  function getDomain(url: string) {
    const result = regExp.exec(url);
    if (!result) return null;
    return result[1];
  }

  $: domain = getDomain(url);
  $: iconUrl = icon ?? `//www.google.com/s2/favicons?domain=${domain}`;
</script>

<a target="_blank" href={url}>
  <img width="16" src={iconUrl} alt="⚡️" />
  <slot />
</a>

<style lang="sass">
  a
    color: #fff
    text-decoration: none
    cursor: pointer
    display: flex
    gap: 5px
    padding: 5px
</style>
