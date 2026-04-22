package util

import "github.com/gofiber/fiber/v2"

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

type PaginatedResponse struct {
	Success bool           `json:"success"`
	Data    interface{}    `json:"data"`
	Meta    PaginationMeta `json:"meta"`
}

type PaginationMeta struct {
	Total   int64 `json:"total"`
	Page    int   `json:"page"`
	PerPage int   `json:"per_page"`
	Pages   int64 `json:"pages"`
}

func Success(c *fiber.Ctx, data interface{}) error {
	return c.JSON(APIResponse{
		Success: true,
		Data:    data,
	})
}

func SuccessMessage(c *fiber.Ctx, message string) error {
	return c.JSON(APIResponse{
		Success: true,
		Message: message,
	})
}

func Error(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(APIResponse{
		Success: false,
		Message: message,
	})
}

// ClampPagination ensures page >= 1 and perPage is between 1 and 100.
func ClampPagination(page, perPage int) (int, int) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	return page, perPage
}

func Paginated(c *fiber.Ctx, data interface{}, total int64, page, perPage int) error {
	pages := total / int64(perPage)
	if total%int64(perPage) != 0 {
		pages++
	}
	return c.JSON(PaginatedResponse{
		Success: true,
		Data:    data,
		Meta: PaginationMeta{
			Total:   total,
			Page:    page,
			PerPage: perPage,
			Pages:   pages,
		},
	})
}
