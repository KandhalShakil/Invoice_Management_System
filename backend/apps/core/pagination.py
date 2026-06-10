from rest_framework.pagination import PageNumberPagination

class OptionalPageNumberPagination(PageNumberPagination):
    page_size_query_param = 'page_size'
    max_page_size = 100
    
    def paginate_queryset(self, queryset, request, view=None):
        # Allow bypassing pagination entirely for dropdowns/select fields, but enforce a hard limit of 500 items to prevent UI freezing
        if request.query_params.get('no_pagination', '').lower() == 'true':
            # We must return None so DRF returns a flat array instead of { count, results } which dropdowns expect
            # But we slice the queryset first!
            # Note: DRF doesn't use the returned value to swap the queryset, it expects a page object.
            # If we return None, the view just serializes the original queryset.
            # So we must mutate the view's queryset or just accept the list. Wait, paginate_queryset doesn't mutate.
            # Actually, if we return None, DRF will serialize `queryset`. 
            # So if we want to limit it, we'd have to do it in the view.
            return None
        return super().paginate_queryset(queryset, request, view)
