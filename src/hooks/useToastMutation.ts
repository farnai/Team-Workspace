import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { getErrorMessage } from '@/lib/api-client'

interface UseToastMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>
  successMessage?: string
  errorMessage?: string
  invalidate?: QueryKey[]
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>
  onError?: (error: Error, variables: TVariables) => void | Promise<void>
}

export function useToastMutation<TData = unknown, TVariables = void>(
  options: UseToastMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, variables) => {
      if (options.invalidate) {
        await Promise.all(
          options.invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key }))
        )
      }
      if (options.onSuccess) {
        await options.onSuccess(data, variables)
      }
    },
    onError: async (err, variables) => {
      const msg = options.errorMessage ?? getErrorMessage(err)
      console.error('Mutation error:', msg, err)
      if (options.onError) {
        await options.onError(err as Error, variables)
      }
    },
  })
}

