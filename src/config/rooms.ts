import config from "src/config/env"

export interface GroupOfRooms {
  groupName: string
  default: boolean
  list: { id: string; name: string }[]
}

export const groupedRooms: GroupOfRooms[] = config.INVITE_ROOMS_LIST
