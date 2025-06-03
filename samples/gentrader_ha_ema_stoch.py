import backtrader as bt
import datetime

class HeikinAshi(bt.Indicator):
    lines = ('ha_open', 'ha_close', 'ha_high', 'ha_low')
    plotinfo = dict(subplot=False)

    def __init__(self):
        self.addminperiod(2)

    def next(self):
        close = (self.data.open[0] + self.data.high[0] + self.data.low[0] + self.data.close[0]) / 4.0
        open_ = (self.lines.ha_open[-1] + self.lines.ha_close[-1]) / 2.0 if len(self) > 1 else self.data.open[0]
        high = max(self.data.high[0], close, open_)
        low = min(self.data.low[0], close, open_)

        self.lines.ha_close[0] = close
        self.lines.ha_open[0] = open_
        self.lines.ha_high[0] = high
        self.lines.ha_low[0] = low

class StrategyHASE(bt.Strategy):
    params = dict(
        ema_period=200,
        stoch_rsi_period=14,
        rsi_period=14,
        stoch_smooth_k=3,
        stoch_smooth_d=3,
        take_profit=0.03,
        stop_loss=0.015
    )

    def __init__(self):
        self.ema = bt.ind.EMA(self.data.close, period=self.p.ema_period)

        rsi = bt.ind.RSI(self.data.close, period=self.p.rsi_period)
        rsi_high = bt.ind.Highest(rsi, period=self.p.stoch_rsi_period)
        rsi_low  = bt.ind.Lowest(rsi, period=self.p.stoch_rsi_period)
        stoch_rsi = (rsi - rsi_low) / (rsi_high - rsi_low + 1e-9)
        self.k = bt.ind.SMA(stoch_rsi, period=self.p.stoch_smooth_k)
        self.d = bt.ind.SMA(self.k, period=self.p.stoch_smooth_d)

        self.cross_up   = bt.ind.CrossOver(self.k, self.d)
        self.cross_down = bt.ind.CrossOver(self.d, self.k)

        self.ha = HeikinAshi(self.data)

    def next(self):
        price = self.data.close[0]
        ema_above = price > self.ema[0]
        ema_below = price < self.ema[0]

        # 진입 조건 (Heikin-Ashi 꼬리 조건은 일단 제거하여 신호를 완화합니다)
        long_cond = (
            ema_above and
            self.cross_up[0] == 1 and
            self.k[0] < 0.2
        )
        short_cond = (
            ema_below and
            self.cross_down[0] == 1 and
            self.k[0] > 0.8
        )

        if not self.position:
            if long_cond:
                dt = self.data.datetime.datetime(0)
                # print(f"{dt} LONG signal, price={price:.2f}")
                self.buy_bracket(
                    price=price,
                    stopprice=price * (1 - self.p.stop_loss),
                    limitprice=price * (1 + self.p.take_profit),
                    exectype=bt.Order.Market
                )
            elif short_cond:
                dt = self.data.datetime.datetime(0)
                # print(f"{dt} SHORT signal, price={price:.2f}")
                self.sell_bracket(
                    price=price,
                    stopprice=price * (1 + self.p.stop_loss),
                    limitprice=price * (1 - self.p.take_profit),
                    exectype=bt.Order.Market
                )
