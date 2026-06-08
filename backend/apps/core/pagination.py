from rest_framework.pagination import PageNumberPagination

class OptionalPageNumberPagination(PageNumberPagination):
    page_size_query_param = 'page_size'
    max_page_size = 100
    
    def paginate_queryset(self, queryset, request, view=None):
        # Allow bypassing pagination entirely for dropdowns/select fields
        if request.query_params.get('no_pagination', '').lower() == 'true':
            return None
        return super().paginate_queryset(queryset, request, view)
