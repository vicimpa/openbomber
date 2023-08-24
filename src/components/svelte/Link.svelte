<script lang="ts">
  export let url = "";
  const regExp = /^https?:\/\/([^\/]+)/;

  function getDomain(url: string) {
    const result = regExp.exec(url);
    if (!result) return null;
    return result[1];
  }

  $: domain = getDomain(url);
</script>

<a target="_blank" href={url}>
  <img
    src={`http://www.google.com/s2/favicons?domain=${domain}`}
    alt="favicon"
  />
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
