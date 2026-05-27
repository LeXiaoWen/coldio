class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || ''
    this.city = process.env.WEATHER_CITY || 'Shanghai'
  }

  get configured() {
    return !!this.apiKey
  }

  async getWeather() {
    if (!this.configured) {
      return {
        status: 'degraded',
        city: this.city,
        summary: '天气 API 未配置',
        temperature: null,
        icon: null
      }
    }

    try {
      const url = new URL('https://api.openweathermap.org/data/2.5/weather')
      url.searchParams.set('q', this.city)
      url.searchParams.set('appid', this.apiKey)
      url.searchParams.set('units', 'metric')
      url.searchParams.set('lang', 'zh_cn')

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`OpenWeather failed: ${response.status}`)
      }

      const data = await response.json()
      const result = {
        status: 'ready',
        city: data.name,
        summary: data.weather?.[0]?.description || '未知',
        temperature: Math.round(data.main?.temp),
        icon: data.weather?.[0]?.icon
          ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
          : null,
        humidity: data.main?.humidity,
        wind: data.wind?.speed
      }

      console.log('[weather]', result.city, result.summary, `${result.temperature}°C`)
      return result
    } catch (e) {
      console.warn('[weather] primary fetch failed:', e.message)
      return this._fallbackWeather()
    }
  }

  async _fallbackWeather() {
    try {
      const response = await fetch(`https://wttr.in/${encodeURIComponent(this.city)}?format=j1`)
      if (!response.ok) throw new Error(`wttr.in failed: ${response.status}`)

      const data = await response.json()
      const current = data.current_condition?.[0]
      if (!current) throw new Error('wttr.in: no current condition data')

      const result = {
        status: 'ready',
        city: this.city,
        summary: current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '未知',
        temperature: Math.round(Number(current.temp_C)),
        icon: `https://wttr.in/${encodeURIComponent(this.city)}_${current.temp_C}0p.png`,
        humidity: current.humidity ? Number(current.humidity) : undefined,
        wind: current.windspeedKmph ? Number(current.windspeedKmph) : undefined
      }

      console.log('[weather] fallback:', result.city, result.summary, `${result.temperature}°C`)
      return result
    } catch (e) {
      console.warn('[weather] fallback also failed:', e.message)
      return {
        status: 'degraded',
        city: this.city,
        summary: `天气获取失败: ${e.message}`,
        temperature: null,
        icon: null
      }
    }
  }
}

module.exports = WeatherService
