import type { Api, RecursiveMethodKeys, ExtractMethod } from '../shared/types'

export type UseChannel<TElectronApi extends Api> = {
  <TChannel extends RecursiveMethodKeys<TElectronApi>>(
    channel: TChannel,
  ): ExtractMethod<TElectronApi, TChannel>
}

export type CreateFn<TElectronApi extends Api> = (helpers: {
  defineHelper: (api: TElectronApi) => TElectronApi
  useChannelAsInvoke: UseChannel<TElectronApi>
  useChannelAsEvent: UseChannel<TElectronApi>
}) => TElectronApi

export type CreateRendererOnlyFn<TElectronApi extends Api> = (helpers: {
  defineHelper: (api: TElectronApi) => TElectronApi
}) => TElectronApi
