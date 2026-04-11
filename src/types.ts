export type ParticipantType = 'internal' | 'external'

export interface Participant {
  firstName: string
  lastName: string
  email: string
  phone: string
  type: ParticipantType
  photo: string
  id: string
  createdAt: string
}

export type RegistrationPayload = Omit<Participant, 'id' | 'createdAt'>
